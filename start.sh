#!/bin/bash

# scripts/start.sh
# Polyglut startup script - reads config/mode.yaml and starts appropriate services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIG_FILE="config/mode.yaml"
LOG_DIR="logs"
PID_DIR="pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[STARTUP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to parse YAML (simple parser for our needs)
parse_yaml() {
    local prefix=$2
    local s='[[:space:]]*' w='[a-zA-Z0-9_]*' fs=$(echo @|tr @ '\034')
    sed -ne "s|^\($s\):|\1|" \
        -e "s|^\($s\)\($w\)$s:$s[\"']\(.*\)[\"']$s\$|\1$fs\2$fs\3|p" \
        -e "s|^\($s\)\($w\)$s:$s\(.*\)$s\$|\1$fs\2$fs\3|p" $1 |
    awk -F$fs '{
        indent = length($1)/2;
        vname[indent] = $2;
        for (i in vname) {if (i > indent) {delete vname[i]}}
        if (length($3) > 0) {
            vn=""; for (i=0; i<indent; i++) {vn=(vn)(vname[i])("_")}
            printf("%s%s%s=%s\n", "'$prefix'",vn, $2, $3);
        }
    }'
}

# Function to check if service is running
is_service_running() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local command=$3
    local log_file="$LOG_DIR/${service_name}.log"
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if is_service_running "$service_name"; then
        print_warning "$service_name is already running (PID: $(cat $pid_file))"
        return 0
    fi
    
    print_status "Starting $service_name on port $port..."
    
    # Start the service in background
    nohup $command > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check if it started successfully
    sleep 2
    if is_service_running "$service_name"; then
        print_status "$service_name started successfully (PID: $pid)"
        return 0
    else
        print_error "Failed to start $service_name"
        rm -f "$pid_file"
        return 1
    fi
}

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill "$pid"
            rm -f "$pid_file"
            print_status "$service_name stopped"
        else
            print_warning "$service_name was not running"
            rm -f "$pid_file"
        fi
    else
        print_warning "$service_name PID file not found"
    fi
}

# Function to check if merge server is required for current mode
is_merge_server_required() {
    local mode=$1
    case $mode in
        "local_network"|"hybrid")
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to start services based on config
start_services() {
    print_status "Reading configuration from $CONFIG_FILE..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Configuration file $CONFIG_FILE not found!"
        exit 1
    fi
    
    # Parse the YAML config
    eval $(parse_yaml "$CONFIG_FILE")
    
    local current_mode=${mode:-"standalone"}
    print_info "Running in $current_mode mode"
    
    # Start main app
    if [[ "${services_app_enabled}" == "true" ]]; then
        local app_port=${services_app_port:-8080}
        start_service "polyglut-app" "$app_port" "npm run dev -- --port $app_port"
    fi
    
    # Start merge queue server
    local merge_enabled=${services_merge_queue_server_enabled:-"false"}
    local merge_auto_start=${services_merge_queue_server_auto_start:-"false"}
    local merge_port=${services_merge_queue_server_port:-4001}
    
    if [[ "$merge_enabled" == "true" && "$merge_auto_start" == "true" ]]; then
        start_service "merge-queue-server" "$merge_port" "node servers/merge-queue-server.js --port $merge_port"
    elif is_merge_server_required "$current_mode"; then
        print_warning "Merge queue server is required for $current_mode mode but auto_start is disabled"
    fi
    
    # Start MCP services
    print_info "Starting enabled MCP services..."
    
    # Filesystem MCP
    if [[ "${services_mcp_services_filesystem_enabled}" == "true" && "${services_mcp_services_filesystem_auto_start}" == "true" ]]; then
        local fs_port=${services_mcp_services_filesystem_port:-9001}
        start_service "mcp-filesystem" "$fs_port" "node servers/mcp-filesystem.js --port $fs_port"
    fi
    
    # Database MCP
    if [[ "${services_mcp_services_database_enabled}" == "true" && "${services_mcp_services_database_auto_start}" == "true" ]]; then
        local db_port=${services_mcp_services_database_port:-9002}
        start_service "mcp-database" "$db_port" "node servers/mcp-database.js --port $db_port"
    fi
    
    # Web scraper MCP
    if [[ "${services_mcp_services_web_scraper_enabled}" == "true" && "${services_mcp_services_web_scraper_auto_start}" == "true" ]]; then
        local ws_port=${services_mcp_services_web_scraper_port:-9003}
        start_service "mcp-web-scraper" "$ws_port" "node servers/mcp-web-scraper.js --port $ws_port"
    fi
    
    # Code runner MCP
    if [[ "${services_mcp_services_code_runner_enabled}" == "true" && "${services_mcp_services_code_runner_auto_start}" == "true" ]]; then
        local cr_port=${services_mcp_services_code_runner_port:-9004}
        start_service "mcp-code-runner" "$cr_port" "node servers/mcp-code-runner.js --port $cr_port"
    fi
    
    print_status "Startup complete!"
    print_info "Check logs in $LOG_DIR/ for service output"
    print_info "Use './scripts/stop.sh' to stop all services"
}

# Function to stop all services
stop_all_services() {
    print_status "Stopping all Polyglut services..."
    
    stop_service "polyglut-app"
    stop_service "merge-queue-server"
    stop_service "mcp-filesystem"
    stop_service "mcp-database" 
    stop_service "mcp-web-scraper"
    stop_service "mcp-code-runner"
    
    print_status "All services stopped"
}

# Function to show service status
show_status() {
    print_status "Polyglut service status:"
    
    local services=("polyglut-app" "merge-queue-server" "mcp-filesystem" "mcp-database" "mcp-web-scraper" "mcp-code-runner")
    
    for service in "${services[@]}"; do
        if is_service_running "$service"; then
            local pid=$(cat "$PID_DIR/${service}.pid")
            echo -e "  ${GREEN}●${NC} $service (PID: $pid)"
        else
            echo -e "  ${RED}●${NC} $service (not running)"
        fi
    done
}

# Main script logic
case "${1:-start}" in
    "start")
        start_services
        ;;
    "stop")
        stop_all_services
        ;;
    "restart")
        stop_all_services
        sleep 2
        start_services
        ;;
    "status")
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start services based on config/mode.yaml"
        echo "  stop    - Stop all running services"
        echo "  restart - Stop and start all services"
        echo "  status  - Show status of all services"
        exit 1
        ;;
esac
