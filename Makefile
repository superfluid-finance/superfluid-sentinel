PROJECT_NAME=superfluid
IMAGE_NAME=sentinel
VERSION=$(ENVIRONMENT)-$(USER)

export IMAGE_TAG=$(IMAGE_NAME):$(VERSION)

# Include environment makefile
ENVIRONMENT=local
-include .env.$(ENVIRONMENT).mk

ifndef ECR_URI
$(error ECR_URI is not set)
endif

################################################################################
# Build targets
################################################################################
build:
	@echo calling docker build...
	docker build \
		--build-arg GITHUB_TOKEN=$(GITHUB_TOKEN) \
		-t $(IMAGE_TAG) .

@PHONY: build

################################################################################
# Compose targets
################################################################################
compose-up:
	docker-compose -p $(PROJECT_NAME) -f docker-compose.yml up

compose-down:
	docker-compose -p $(PROJECT_NAME) -f docker-compose.$(ENVIRONMENT).yml down

@PHONY: compose-up

################################################################################
# ECR targets
################################################################################
ecr-login:
	aws --region $(AWS_DEFAULT_REGION) ecr get-login-password | docker login --username AWS --password-stdin $(ECR_URI)

ecr-push: ecr-login
	docker tag $(IMAGE_TAG) $(ECR_URI)/$(IMAGE_TAG)
	docker push $(ECR_URI)/$(IMAGE_TAG)

@PHONY: ecr-login ecr-push

################################################################################
# ECS targets
################################################################################
ecs-print-task-definition:
	node -p 'require("./deployment/ecs-task.js")' | jq

ecs-update-task:
	TMP_FILE=`mktemp`; \
	node -p 'require("./deployment/ecs-task.js")' > $$TMP_FILE; \
	aws ecs register-task-definition --cli-input-json file://$$TMP_FILE; \
	rm -f $$TMP_FILE
