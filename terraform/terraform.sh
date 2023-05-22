#!/usr/bin/env bash

##### Get terraform binary
TERRAFORM_BINARY=${TERRAFORM_BINARY:-"$(which terraform)"}

# Maps Environment names to Terraform state buckets
declare -A BUCKETS
declare -A AWS_ROLES
# find path to .env
BASE_PATH="$(cd "$(dirname "$0")" && pwd)"
if [ -f $BASE_PATH/.env ]
then
  set -o allexport
  source $BASE_PATH/.env
  set +o allexport
fi

COMMANDS=("apply" "destroy" "import" "init" "plan" "refresh" "state")
TEMPFILES=()
ENVIRONMENT=""

finish() {
  echo ""
  echo "Begin cleanup..."
  for f in "${TEMPFILES[@]}"; do
    echo "Deleting symlink ${f}..."
    rm "${f}"
  done
  for f in "${DISABLEDFILES[@]}"; do
    echo "Changing ${f} back to original name..."
    mv ${f} `basename -s ".disabled" ${f}`
  done
  echo "Done."
  echo ""
}

elementIn() {
  local needle="${1}"
  shift
  local haystack=("${@}")

  for e in "${haystack[@]}"; do
    if [[ "${needle}" == "${e}" ]]; then
      return 0
    fi
  done
  return 1
}

showHelp() {
    local commands=$(echo "${!COMMANDS[@]}>" | tr " " "|")
    local environments=$(echo "${!BUCKETS[@]}>" | tr " " "|")
    echo "Usage: "
    echo "${0} <${environments}> <${commands}>"
    echo ""
    kill -1 $$
}

symlinkEnvFiles() {
  shopt -s nullglob
  TEMPFILES=()
  for f in *."${ENVIRONMENT}"; do
    new_name="${f}.`date +%s`.tf"
    echo "Temporarily renaming ${f} to ${new_name}"
    ln -s "${f}" "${new_name}"
    TEMPFILES+=(${new_name})
  done
  shopt -u nullglob
}

disableFiles() {
  # This looks for terraform files with a comment that matches:
  # # DISABLED_ENVIRONMENTS: <env1>, <env2>
  # If current env is in the list, we rename the .tf file to append .disabled
  shopt -s nullglob
  DISABLEDFILES=()
  for f in *.tf; do
    if grep --quiet "^# DISABLED_ENVIRONMENTS: .*\(${ENVIRONMENT}\).*" ${f}; then
      new_name="${f}.disabled"
      echo "Temporarily renaming disabled ${f} to ${new_name}"
      mv "${f}" "${new_name}"
      DISABLEDFILES+=(${new_name})
    fi
  done
  shopt -u nullglob
}

terraformInit() {
    local env="${1}"
    current_bucket=$(cat .terraform/terraform.tfstate | jq -r '.["backend"]["config"]["bucket"]')
    if [[ ${BUCKETS[$env]} == "${current_bucket}" ]]; then
        ${TERRAFORM_BINARY} init -reconfigure -backend-config="bucket=${BUCKETS[$env]}"
        echo "Terraform initialized: env=${env} | bucket=${current_bucket}"
        return
    fi
    echo "Running terraform init..."
    if [ ${AWS_ROLES[$env]} ]; then
        echo "using: env=${env} | ${BUCKETS[$env]} | role_arn=${AWS_ROLES[$env]}"
        ${TERRAFORM_BINARY} init -reconfigure \
        -backend-config="bucket=${BUCKETS[$env]}" \
        -backend-config="role_arn=${AWS_ROLES[$env]}"
        if [[ $? -ne 0 ]]; then
          finish
          kill -1 $$
        fi
        echo "Terraform initialized using: env=${env} | ${BUCKETS[$env]} | role_arn=${AWS_ROLES[$env]}"
      else
        ${TERRAFORM_BINARY} init -reconfigure \
        -backend-config="bucket=${BUCKETS[$env]}"
        if [[ $? -ne 0 ]]; then
          finish
          kill -1 $$
        fi
    fi
}

main() {
    ENVIRONMENT="${1}"
    if ! $(elementIn "${ENVIRONMENT}" "${!BUCKETS[@]}"); then
        echo "Invalid environment specified."
        echo ""
        showHelp
    fi

    symlinkEnvFiles
    disableFiles

    terraformInit "${ENVIRONMENT}"

    shift
    command="${1}"
    if ! $(elementIn "${command}" "${COMMANDS[@]}"); then
        echo "Invalid command specified."
        echo ""
        showHelp
    fi

    shift
    if [[ "${command}" != "init" ]]; then
        echo ""
        echo "Current ${TERRAFORM_BINARY} environment: Environment=${ENVIRONMENT}"
        echo ""
        if [[ "${command}" != "state" ]]; then
          tf_command="${TERRAFORM_BINARY} ${command}"
          for tfvarfile in ./environments/${ENVIRONMENT}.tfvars; do
            # support arbitrary tfvarfiles
            tf_command="${tf_command} -var-file=$tfvarfile"
          done
        else tf_command="${TERRAFORM_BINARY} ${command}"
        fi
        eval ${tf_command} '$@'
    fi
}

main $@

trap finish EXIT INT QUIT TERM SIGHUP