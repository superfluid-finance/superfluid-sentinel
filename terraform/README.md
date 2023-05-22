# Sentinel IaC


## Overview
The terraform code is made up of:
- Networking (1 VPC, Two Public and Two Private Subnets, NAT Gateway and Routes )
- IAM Roles and Policies
- ECS Cluster
- ECS Task and Service (Fargate)

### How to Deploy
- Depending on the registry you use, you have to populate the following secrets in Github
```
CR_ACCESS_TOKEN
CR_USERNAME

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```
- Create an S3 Bucket to host your and also your `.env` variables.
- Upload your env file to the s3 bucket

#### Two Approches

##### 1: Push to main branch

- Edit your ./github/workflows/terraform.yml by inputing the following variables
```
env:
  TF_VAR_image_id: "mmdafegbua/balatinel"
  TF_VAR_bucket_name: "sentinel-drop-test-bucket"
```
•   TF_VAR_image_id - This is your IMAGE ID in the format `<username>/<repository>`
•   TF_VAR_bucket_name - Name of bucket created for your `env` file.
- Push to main branch

- Push changes to main branch

##### 2: Create a feature branch

- Create a new branch from the `main` branch.
- Edit your ./github/workflows/terraform.yml file
- Push changes and create a pull request.
- Check Terraform Plan Outputs
- Merge. On Merging, changes are deployed to the environments.

For each CI/CD pipeline, an image is built and tagged with the git commit SHA.
