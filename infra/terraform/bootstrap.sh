#!/usr/bin/env bash
# One-time bootstrap of WCO Terraform remote state (S3 + DynamoDB lock).
# Run ONCE per AWS account; the bucket and table must exist before `terraform init`.
set -euo pipefail

STATE_BUCKET="wco-terraform-state"
LOCK_TABLE="wco-terraform-locks"
REGION="${AWS_REGION:-eu-west-1}"

echo "==> Ensuring state bucket: ${STATE_BUCKET}"
aws s3api create-bucket \
  --bucket "${STATE_BUCKET}" \
  --region "${REGION}" \
  --create-bucket-configuration LocationConstraint="${REGION}" 2>/dev/null || \
  echo "bucket already exists (or CreateBucketConfiguration unsupported for us-east-1)"

aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'

aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

echo "==> Ensuring lock table: ${LOCK_TABLE}"
aws dynamodb create-table \
  --table-name "${LOCK_TABLE}" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "${REGION}" 2>/dev/null || echo "lock table already exists"

echo "Done. Run: cd infra/terraform && terraform init && terraform plan"
