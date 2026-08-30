# Shared remote state with DynamoDB locking.
# The state bucket + lock table are bootstrapped once by
# infra/terraform/bootstrap.sh (see infra/terraform/README.md).
terraform {
  backend "s3" {
    bucket         = "wco-terraform-state"
    key            = "platform/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "wco-terraform-locks"
    encrypt        = true
  }
}
