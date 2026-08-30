# =============================================================================
# WCO VPC — 3-AZ, public + private tiers.
#   public  : ALB, NAT gateways (and bastion if enabled)
#   private : EKS nodes/pods, RDS, ElastiCache, Amazon MQ (no internet egress
#             except through NAT; egress policy is locked down at the SG level)
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.prefix}-vpc" }
}

# ---- Internet gateway (public path) ----------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.prefix}-igw" }
}

# ---- Subnets ----------------------------------------------------------------
resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.cidrs.public[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${var.prefix}-public-${var.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.cidrs.private[count.index]
  availability_zone = var.azs[count.index]
  tags = { Name = "${var.prefix}-private-${var.azs[count.index]}", Tier = "private" }
}

# ---- Public route table (IGW) ------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.prefix}-rt-public" }
}

resource "aws_route" "public_igw" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---- NAT gateways (one per AZ for HA egress) --------------------------------
resource "aws_eip" "nat" {
  count = length(aws_subnet.public)
  tags  = { Name = "${var.prefix}-nat-eip-${count.index}" }
}

resource "aws_nat_gateway" "main" {
  count         = length(aws_subnet.public)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "${var.prefix}-nat-${count.index}" }
}

resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.prefix}-rt-private-${count.index}" }
}

resource "aws_route" "private_nat" {
  count                  = length(aws_subnet.private)
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[count.index].id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
