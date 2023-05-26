terraform {
  backend "s3" {
    bucket = "superfluid-sentinel-terraform-state-bucket"
    key    = "dev/terraform.tfstate"
    region = "eu-west-1"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.67.0"
    }
  }
}