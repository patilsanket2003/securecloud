#!/bin/bash

# SecureCloud AWS Deployment Script
# This script automates the deployment of SecureCloud to AWS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="securecloud"
EC2_INSTANCE_TYPE="t3.micro"
RDS_INSTANCE_CLASS="db.t3.micro"
S3_BUCKET_NAME="securecloud-$(date +%s)-$(openssl rand -hex 4)"

echo -e "${GREEN}🚀 Starting SecureCloud AWS Deployment${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI first.${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 1: Create ECR repository
echo -e "${YELLOW}🏷️  Creating ECR repository...${NC}"
aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION || echo "Repository already exists"

# Get ECR login
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com

# Step 2: Build and push Docker image
echo -e "${YELLOW}🐳 Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY:latest .

# Tag image for ECR
ECR_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
docker tag $ECR_REPOSITORY:latest $ECR_REGISTRY/$ECR_REPOSITORY:latest

# Push to ECR
echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

# Step 3: Create S3 bucket
echo -e "${YELLOW}🪣 Creating S3 bucket...${NC}"
aws s3 mb s3://$S3_BUCKET_NAME --region $AWS_REGION || echo "Bucket already exists"

# Enable versioning
aws s3api put-bucket-versioning --bucket $S3_BUCKET_NAME --versioning-configuration Status=Enabled

# Step 4: Create RDS subnet group and database
echo -e "${YELLOW}🗄️  Creating RDS database...${NC}"

# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs --query "Vpcs[?IsDefault].VpcId" --output text)
echo "Using VPC: $VPC_ID"

# Create subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name securecloud-subnet-group \
    --db-subnet-group-description "Subnet group for SecureCloud" \
    --subnet-ids $(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID --query "Subnets[?MapPublicIpOnLaunch].SubnetId" --output text | tr '\t' ',')

# Create security group for RDS
RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name securecloud-rds-sg \
    --description "Security group for SecureCloud RDS" \
    --vpc-id $VPC_ID \
    --query "GroupId" \
    --output text)

# Allow PostgreSQL access from EC2
aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG_ID \
    --protocol tcp \
    --port 5432 \
    --source-group sg-$(aws ec2 describe-security-groups --group-names default --query "SecurityGroups[0].GroupId" --output text)

# Create RDS instance
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
aws rds create-db-instance \
    --db-instance-identifier securecloud-db \
    --db-instance-class $RDS_INSTANCE_CLASS \
    --engine postgres \
    --engine-version 15.4 \
    --master-username securecloud \
    --master-user-password $DB_PASSWORD \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-name securecloud \
    --db-subnet-group-name securecloud-subnet-group \
    --vpc-security-group-ids $RDS_SG_ID \
    --backup-retention-period 7 \
    --multi-az \
    --storage-encrypted \
    --no-publicly-accessible || echo "RDS instance already exists"

# Step 5: Create EC2 instance
echo -e "${YELLOW}🖥️  Creating EC2 instance...${NC}"

# Create security group for EC2
EC2_SG_ID=$(aws ec2 create-security-group \
    --group-name securecloud-ec2-sg \
    --description "Security group for SecureCloud EC2" \
    --vpc-id $VPC_ID \
    --query "GroupId" \
    --output text)

# Allow HTTP, HTTPS, and SSH
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0

# Create user data script
cat > user-data.sh << EOF
#!/bin/bash
yum update -y
yum install -y docker git nginx
systemctl start docker
systemctl enable docker
systemctl start nginx
systemctl enable nginx

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /opt/securecloud
cd /opt/securecloud

# Create docker-compose.yml
cat > docker-compose.yml << 'EOL'
version: '3.8'

services:
  securecloud:
    image: $ECR_REGISTRY/$ECR_REPOSITORY:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://securecloud:$DB_PASSWORD@securecloud-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com:5432/securecloud
      - JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters-long
      - STORAGE_TYPE=s3
      - AWS_S3_BUCKET=$S3_BUCKET_NAME
      - AWS_REGION=$AWS_REGION
      - AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
      - ADMIN_EMAIL=admin@yourdomain.com
      - ADMIN_PASSWORD=admin123456
      - ADMIN_NAME="System Administrator"
      - APP_URL=https://yourdomain.com
    volumes:
      - uploads_data:/app/uploads
    restart: unless-stopped

volumes:
  uploads_data:
    driver: local
EOL

# Pull and start the application
docker-compose pull
docker-compose up -d

# Setup SSL (optional - requires domain)
# certbot --nginx -d yourdomain.com

echo "SecureCloud deployment completed!"
EOF

# Launch EC2 instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --instance-type $EC2_INSTANCE_TYPE \
    --key-name your-key-pair \
    --security-group-ids $EC2_SG_ID \
    --subnet-id $(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID Name=MapPublicIpOnLaunch,Values=true --query "Subnets[0].SubnetId" --output text) \
    --user-data file://user-data.sh \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=securecloud-app}]' \
    --query "Instances[0].InstanceId" \
    --output text)

echo -e "${YELLOW}⏳ Waiting for EC2 instance to be ready...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application will be available at: http://$PUBLIC_IP${NC}"
echo -e "${GREEN}📊 Database endpoint: securecloud-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com${NC}"
echo -e "${GREEN}🪣 S3 bucket: $S3_BUCKET_NAME${NC}"
echo -e "${GREEN}🔑 Database password: $DB_PASSWORD${NC}"
echo -e "${GREEN}🖥️  EC2 instance ID: $INSTANCE_ID${NC}"

# Save deployment info
cat > deployment-info.txt << EOF
SecureCloud AWS Deployment Information
=====================================

Deployment Time: $(date)
AWS Region: $AWS_REGION
EC2 Instance: $INSTANCE_ID
Public IP: $PUBLIC_IP
Database: securecloud-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
S3 Bucket: $S3_BUCKET_NAME
Database Password: $DB_PASSWORD
ECR Repository: $ECR_REGISTRY/$ECR_REPOSITORY

Next Steps:
1. Wait 5-10 minutes for the application to start
2. Access the application at http://$PUBLIC_IP
3. Login with admin@yourdomain.com / admin123456
4. Configure your domain name and SSL certificate
5. Set up monitoring and backups

Cleanup Commands:
aws ec2 terminate-instances --instance-ids $INSTANCE_ID
aws rds delete-db-instance --db-instance-identifier securecloud-db --skip-final-snapshot
aws s3 rb s3://$S3_BUCKET_NAME --force
aws ecr delete-repository --repository-name $ECR_REPOSITORY --force
EOF

echo -e "${GREEN}📄 Deployment information saved to deployment-info.txt${NC}"
echo -e "${YELLOW}⚠️  Please save the database password and other credentials securely!${NC}"
