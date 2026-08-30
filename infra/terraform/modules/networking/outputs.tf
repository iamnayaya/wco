// Networking module output contract consumed by the root.
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnets" {
  description = "IDs of private subnets (data plane, pods, RDS/Redis/MQ)"
  value       = aws_subnet.private[*].id
}

output "public_subnets" {
  description = "IDs of public subnets (NAT, ALB, bastion)"
  value       = aws_subnet.public[*].id
}

output "nat_gateway_ids" {
  value = aws_nat_gateway.main[*].id
}
