terraform {
  backend "s3" {
    bucket  = "sentinel-drop-test-bucket"
    key     = "sentinel/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
