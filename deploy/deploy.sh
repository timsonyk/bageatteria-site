#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="slytn.ru"
EMAIL="admin@slytn.ru"

echo -e "${GREEN}=== Bageatteria Deploy Script ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./deploy.sh)${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get update
    apt-get install -y docker-compose-plugin
fi

cd "$(dirname "$0")/.."

# Create directories
mkdir -p certbot/conf certbot/www

# Check if certificates exist
if [ ! -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${YELLOW}SSL certificates not found. Getting certificates from Let's Encrypt...${NC}"

    # Create temporary nginx config for certificate validation
    mkdir -p deploy/nginx/sites-temp
    cat > deploy/nginx/sites-temp/default.conf << 'EOF'
server {
    listen 80;
    server_name slytn.ru www.slytn.ru api.slytn.ru admin.slytn.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

    # Start nginx for ACME challenge
    docker run -d --name nginx-certbot \
        -p 80:80 \
        -v "$(pwd)/deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
        -v "$(pwd)/deploy/nginx/sites-temp:/etc/nginx/sites-enabled:ro" \
        -v "$(pwd)/certbot/www:/var/www/certbot:ro" \
        nginx:alpine

    sleep 5

    # Get certificates
    docker run --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        certbot/certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN \
        -d api.$DOMAIN \
        -d admin.$DOMAIN

    # Stop temporary nginx
    docker stop nginx-certbot
    docker rm nginx-certbot
    rm -rf deploy/nginx/sites-temp

    echo -e "${GREEN}SSL certificates obtained successfully!${NC}"
fi

# Check backend .env
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}ERROR: backend/.env not found!${NC}"
    echo "Please copy backend/env.example to backend/.env and configure it."
    exit 1
fi

# Build and start all services
echo -e "${YELLOW}Building and starting services...${NC}"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
sleep 10  # Wait for database to be ready
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

echo -e "${GREEN}=== Deployment completed! ===${NC}"
echo ""
echo "Your services are now running at:"
echo -e "  ${GREEN}https://slytn.ru${NC} - Main site"
echo -e "  ${GREEN}https://api.slytn.ru${NC} - API"
echo -e "  ${GREEN}https://admin.slytn.ru${NC} - Admin panel"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f    # View logs"
echo "  docker compose -f docker-compose.prod.yml restart    # Restart services"
echo "  docker compose -f docker-compose.prod.yml down       # Stop services"
