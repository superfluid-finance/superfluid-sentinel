data "aws_availability_zones" "available" {}

locals {
  region = "us-east-1"
  name   = "sentinel"

  vpc_cidr = "10.0.0.0/16"
  azs      = slice(data.aws_availability_zones.available.names, 0, 2)

  container_name = "sentinel"
  container_port = 9100

  tags = {
    Name = local.name
  }

  env_bucket_arn = "arn:aws:s3:::sentinel-drop-test-bucket"
}

################################################################################
#ECS Cluster
################################################################################

module "ecs_cluster" {
  source  = "terraform-aws-modules/ecs/aws//modules/cluster"
  version = "5.0.1"

  cluster_name = local.name

  # Capacity provider
  fargate_capacity_providers = {
    FARGATE = {
      default_capacity_provider_strategy = {
        weight = 50
        base   = 20
      }
    }
    FARGATE_SPOT = {
      default_capacity_provider_strategy = {
        weight = 50
      }
    }
  }

  tags = local.tags
}

################################################################################
# Service
################################################################################

module "ecs_service" {
  source  = "terraform-aws-modules/ecs/aws//modules/service"
  version = "5.0.1"

  # Service
  name        = local.name
  cluster_arn = module.ecs_cluster.arn

  # Role for task. Set to allow it pull .env from s3 bucket
  task_exec_iam_role_policies = {
    s3Access = aws_iam_policy.policy.arn
  }

  volume = {
    efs_volume_configuration = {
      name                    = "sentinel"
      file_system_id          = aws_efs_file_system.sentinel.id
      root_directory          = "data"
      transit_encryption      = "ENABLED"
      transit_encryption_port = 2999
      authorization_config = {
        access_point_id = aws_efs_access_point.sentinel.id
        iam             = "ENABLED"
      }
    }
  }

  cpu    = 1024
  memory = 4096

  # Container definition(s)
  container_definitions = {
    (local.container_name) = {
      image = "${var.image_id}:${var.image_tag}"
      port_mappings = [
        {
          name          = local.container_name
          containerPort = local.container_port
          protocol      = "tcp"
        }
      ]

      environment_files = [
        {
          value = "${local.env_bucket_arn}/.env"
          type  = "s3"
        }
      ]

      environment = [
        {
          name  = "DB_PATH"
          value = "data/db.sqlite"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "METRICS_PORT"
          value = "9100"
        }
      ]

      mount_points = [
        {
          sourceVolume  = "sentinel",
          containerPath = "/app/data"
          readOnly      = false
        }
      ]

      readonly_root_filesystem = false
    },
  }

  # Service discovery
  service_connect_configuration = {
    namespace = aws_service_discovery_http_namespace.this.arn
    service = {
      client_alias = {
        port     = local.container_port
        dns_name = local.container_name
      }
      port_name      = local.container_name
      discovery_name = local.container_name
    }
  }

  assign_public_ip = true

  subnet_ids = module.vpc.public_subnets
  security_group_rules = {
    alb_http_ingress = {
      type                     = "ingress"
      from_port                = local.container_port
      to_port                  = local.container_port
      protocol                 = "tcp"
      description              = "Service custom port"
      source_security_group_id = module.alb_sg.security_group_id
    },
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  tags = local.tags
}

################################################################################
# Supporting Resources
################################################################################

# https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html#ecs-optimized-ami-linux
data "aws_ssm_parameter" "ecs_optimized_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended"
}


resource "aws_iam_policy" "policy" {
  name        = "bucket_policy"
  path        = "/"
  description = "Bucket containing .env"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
        ]
        Effect   = "Allow"
        Resource = "${local.env_bucket_arn}/.env"
      },
      {
        Action = [
          "s3:GetBucketLocation",
        ]
        Effect   = "Allow"
        Resource = "${local.env_bucket_arn}"
      }
    ]
  })
}

resource "aws_service_discovery_http_namespace" "this" {
  name        = local.name
  description = "CloudMap namespace for ${local.name}"
  tags        = local.tags
}


resource "aws_efs_file_system" "sentinel" {
  creation_token = "sentinel"

  tags = {
    Name = "sentinel"
  }

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
}

resource "aws_efs_access_point" "sentinel" {
  file_system_id = aws_efs_file_system.sentinel.id
}

################################################################################
# Cluster
################################################################################

output "cluster_arn" {
  description = "ARN that identifies the cluster"
  value       = module.ecs_cluster.arn
}

output "cluster_id" {
  description = "ID that identifies the cluster"
  value       = module.ecs_cluster.id
}

output "cluster_name" {
  description = "Name that identifies the cluster"
  value       = module.ecs_cluster.name
}


################################################################################
# Service
################################################################################

output "service_id" {
  description = "ARN that identifies the service"
  value       = module.ecs_service.id
}

output "service_name" {
  description = "Name of the service"
  value       = module.ecs_service.name
}