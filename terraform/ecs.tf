resource "aws_ecs_cluster" "sentinel_cluster" {
  name = "sentinel-cluster"
}

resource "aws_ecr_repository" "sentinel_repository" {
  name = "sentinel-repository"
}

resource "aws_ecs_task_definition" "sentinel_task" {
  family                   = "sentinel-task"
  execution_role_arn       = aws_iam_role.sentinel_task_execution_role.arn
  task_role_arn            = aws_iam_role.sentinel_task_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]

  cpu = "256"
  memory = "512"

  container_definitions = <<EOF
  [
    {
      "name": "sentinel-container",
      "image": "${aws_ecr_repository.sentinel_repository.repository_url}:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "hostPort": 80,
          "protocol": "tcp"
        }
      ],
      "essential": true
    }
  ]
  EOF
}

resource "aws_iam_role" "sentinel_task_execution_role" {
  name               = "sentinel-task-execution-role"
  assume_role_policy = <<EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "",
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF
}

resource "aws_iam_role" "sentinel_task_role" {
  name               = "sentinel-task-role"
  assume_role_policy = <<EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "",
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF
}

resource "aws_ecs_service" "sentinel_service" {
  name            = "sentinel-service"
  cluster         = aws_ecs_cluster.sentinel_cluster.id
  task_definition = aws_ecs_task_definition.sentinel_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    security_groups = [aws_security_group.sentinel_sg.id]
    subnets = [module.vpc.public_subnets[0], module.vpc.public_subnets[1], module.vpc.public_subnets[2]]
    assign_public_ip = true
  }
}

resource "aws_security_group" "sentinel_sg" {
  name        = "sentinel-security-group"
  description = "Security group for Sentinel service"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}