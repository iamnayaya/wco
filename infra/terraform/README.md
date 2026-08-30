# WCO Infrastructure as Code (Terraform)

Production-grade AWS platform for WCO, composed of reusable modules and driven
per-environment by tfvars workspaces. Remote state lives in S3 with DynamoDB
locking; all secrets flow from AWS Secrets Manager at apply time — never Git.

## Layout

```
infra/terraform/
├── main.tf            # Root composition: wiring modules together
├── providers.tf       # AWS + Kubernetes + Helm providers
├── backend.tf         # S3 remote state + DynamoDB locking
├── versions.tf        # Provider/version pinning
├── variables.tf / outputs.tf
├── bootstrap.sh       # One-time state bucket + lock table creation
├── modules/
│   ├── networking/    # VPC, subnets, IGW, NAT, route tables, per-tier SGs
│   ├── eks/           # EKS cluster, node groups, OIDC, IRSA pod roles
│   ├── cluster/       # RDS, ElastiCache, Amazon MQ (RabbitMQ)
│   ├── edge/          # S3 + CloudFront, Route53, ACM, WAFv2
│   ├── security/      # GuardDuty, Security Hub, Inspector2, budgets, SNS
│   └── observability/ # CloudWatch alarms over managed services → SNS
└── envs/
    ├── dev/           # cheapest viable cluster
    ├── staging/       # prod-shaped, reduced capacity
    └── prod/          # full multi-AZ, spot workers, strict safeguards
```

## Prerequisites

- Terraform >= 1.6
- AWS CLI authenticated (or IRSA in CI)
- `./bootstrap.sh` run once per account (creates state bucket + lock table)

## Usage

```bash
# 1. Bootstrap remote state (once)
./bootstrap.sh

# 2. Init against an environment workspace
cd envs/prod
cp terraform.tfvars.example terraform.tfvars   # fill real values
cd ../..
terraform init

# 3. Plan + apply
terraform plan -var-file=envs/prod/terraform.tfvars
terraform apply -var-file=envs/prod/terraform.tfvars
```

In CI this is wrapped by `.github/workflows/terraform.yml` with an approval gate
for production and drift detection on a schedule.

## Design decisions

- **Multi-AZ everything** in prod: RDS Multi-AZ + 3-node Redis + MQ cluster mode.
- **Spot workers** for stateless tiers (webhook-handler, AI engine) to cut
  compute cost ~60–70% while on-demand pods carry stateful/async-critical paths.
- **IRSA** replaces static keys: pods assume least-privilege AWS roles via
  OIDC; `infra/kubernetes/base/serviceaccount.yaml` annotations match the roles
  this module creates.
- **WAFv2 ACL** is produced here and attached to the ALB by the ingress
  (`infra/kubernetes/base/ingress.yaml` annotation `wafv2-acl-arn`).
- **State encryption + locking** everywhere; PII-rich tfvars are sourced from
  Secrets Manager, not the repo.

## Boundaries / ownership

| Owner        | Files                                          |
|--------------|------------------------------------------------|
| Networking   | `modules/networking/`                          |
| Cluster      | `modules/eks/`, `modules/cluster/`             |
| Edge/Security| `modules/edge/`, `modules/security/`           |
| Observability| `modules/observability/` + `infra/monitoring/` |
