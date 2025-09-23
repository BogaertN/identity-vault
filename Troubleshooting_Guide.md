Identity Vault Pro - Troubleshooting Guide
Version 1.0 | Advanced Diagnostics & Support Documentation

Table of Contents
Troubleshooting Overview
System Diagnostics
Authentication Issues
Profile Management Problems
Agent Orchestration Issues
Performance Troubleshooting
Database Issues
Network Connectivity Problems
API Troubleshooting
Security-Related Issues
Integration Problems
Monitoring & Logging Issues
Recovery Procedures
Advanced Diagnostics
Support Resources

1. Troubleshooting Overview
1.1 Troubleshooting Methodology
Systematic Approach:
Problem Identification → Information Gathering → Analysis → Solution Implementation → Verification → Documentation
         ↓                        ↓               ↓                ↓                    ↓              ↓
    Define symptoms         Collect logs      Root cause      Apply fixes        Test results   Update KB
    Set priorities         System status     analysis        Monitor impact     Confirm fix    Share learning
    Gather context         User reports      Hypothesis      Rollback plan      User validation Document steps

Troubleshooting Principles:
Start Simple: Check basic issues first
Gather Evidence: Collect comprehensive diagnostic data
Isolate Variables: Change one thing at a time
Document Everything: Maintain detailed records
Test Thoroughly: Verify fixes don't introduce new issues
Plan Rollbacks: Have recovery plans ready
1.2 Diagnostic Tools
Built-in Diagnostic Commands:
# System health check
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/health

# Detailed system diagnostics
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/health?detailed=true

# Check specific components
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/health?components=database,memory,storage

# Profile diagnostics
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/profiles/user/test_id?includeState=true&includeLogs=true

# Agent status check
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/agents/status/orchestration_id

External Diagnostic Tools:
System Monitoring: htop, iostat, netstat, ss
Network Analysis: tcpdump, wireshark, nmap, telnet
Database Tools: SQLite browser, sqlite3 CLI
Log Analysis: grep, awk, sed, jq
Process Analysis: ps, lsof, strace
1.3 Log Levels and Categories
Log Level Hierarchy:
ERROR   → System errors, failed operations
WARN    → Warnings, potential issues  
INFO    → General operational information
DEBUG   → Detailed diagnostic information
TRACE   → Extremely detailed execution flow

Log Categories:
Authentication: Login attempts, token validation
Authorization: Permission checks, access control
Profile Operations: CRUD operations on profiles
Agent Management: Orchestration and monitoring
Security Events: Security-related activities
Performance: Response times, resource usage
Integration: External system communications
Database: Database operations and errors

2. System Diagnostics
2.1 Health Check Procedures
2.1.1 Basic System Health
Quick Health Assessment:
#!/bin/bash
# Identity Vault health check script

echo "=== Identity Vault Pro Health Check ==="
echo "Timestamp: $(date)"
echo

# 1. Process check
echo "1. Process Status:"
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Identity Vault process is running"
    PID=$(pgrep -f "node.*server.js")
    echo "   Process ID: $PID"
    echo "   Uptime: $(ps -o etime= -p $PID | tr -d ' ')"
else
    echo "❌ Identity Vault process not found"
fi
echo

# 2. Port check
echo "2. Network Connectivity:"
if netstat -tuln | grep -q ":3000 "; then
    echo "✅ Port 3000 is listening"
else
    echo "❌ Port 3000 is not accessible"
fi
echo

# 3. API response check
echo "3. API Response Test:"
if curl -s -f -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/health > /dev/null; then
    echo "✅ API is responding"
    RESPONSE=$(curl -s -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/health)
    echo "   Status: $(echo $RESPONSE | jq -r '.status')"
    echo "   Version: $(echo $RESPONSE | jq -r '.version')"
else
    echo "❌ API is not responding"
fi
echo

# 4. Database check
echo "4. Database Status:"
if [ -f "vault.db" ]; then
    echo "✅ Database file exists"
    DB_SIZE=$(du -h vault.db | cut -f1)
    echo "   Size: $DB_SIZE"
    
    # Test database accessibility
    if sqlite3 vault.db "SELECT COUNT(*) FROM sqlite_master;" > /dev/null 2>&1; then
        echo "✅ Database is accessible"
        TABLE_COUNT=$(sqlite3 vault.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        echo "   Tables: $TABLE_COUNT"
    else
        echo "❌ Database access failed"
    fi
else
    echo "❌ Database file not found"
fi
echo

# 5. Disk space check
echo "5. System Resources:"
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 90 ]; then
    echo "✅ Disk usage: ${DISK_USAGE}%"
else
    echo "⚠️ Disk usage critical: ${DISK_USAGE}%"
fi

MEMORY_USAGE=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
echo "   Memory usage: ${MEMORY_USAGE}%"
echo

echo "=== Health Check Complete ==="

2.1.2 Detailed System Analysis
Comprehensive System Diagnostics:
#!/bin/bash
# Detailed system diagnostics

echo "=== Detailed System Diagnostics ==="

# System information
echo "System Information:"
echo "  OS: $(uname -a)"
echo "  Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "  npm: $(npm --version 2>/dev/null || echo 'Not found')"
echo "  SQLite: $(sqlite3 --version 2>/dev/null || echo 'Not found')"
echo

# Resource utilization
echo "Resource Utilization:"
echo "  CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 $3 $4 $5 $6 $7 $8}' | sed 's/%us,/% user,/g'

echo "  Memory Usage:"
free -h | grep -E "(Mem|Swap)"

echo "  Disk Usage:"
df -h | grep -E "(Filesystem|/dev/)"

echo "  Load Average:"
uptime

echo

# Network status
echo "Network Status:"
echo "  Active connections:"
ss -tuln | grep -E "(3000|443|80)"

echo "  Network interfaces:"
ip addr show | grep -E "(inet|eth|lo)" | head -10

echo

# Process details
echo "Process Information:"
ps aux | grep -E "(node|identit)" | grep -v grep

echo

# File system checks
echo "File System Status:"
echo "  Current directory: $(pwd)"
echo "  Directory contents:"
ls -la | head -20

if [ -f "package.json" ]; then
    echo "  Package.json version: $(jq -r '.version' package.json 2>/dev/null)"
fi

if [ -f ".env" ]; then
    echo "  Environment file: ✅ Present"
    echo "  Environment variables:"
    echo "    NODE_ENV: ${NODE_ENV:-'not set'}"
    echo "    PORT: ${PORT:-'not set'}"
    echo "    API_TOKEN length: ${#API_TOKEN}"
else
    echo "  Environment file: ❌ Missing"
fi

echo
echo "=== Diagnostics Complete ==="

2.2 Performance Monitoring
2.2.1 Real-Time Performance Metrics
Performance Monitoring Script:
#!/bin/bash
# Real-time performance monitoring

INTERVAL=5
DURATION=60
ITERATIONS=$((DURATION / INTERVAL))

echo "=== Performance Monitoring (${DURATION}s) ==="
echo "Collecting metrics every ${INTERVAL}s..."
echo

# CSV header
echo "timestamp,cpu_percent,memory_mb,memory_percent,disk_io_read,disk_io_write,network_rx,network_tx,response_time_ms" > performance_log.csv

for i in $(seq 1 $ITERATIONS); do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # CPU usage
    CPU_PERCENT=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    
    # Memory usage
    MEMORY_INFO=$(free | awk 'NR==2{printf "%.0f,%.1f", $3/1024, $3*100/$2}')
    
    # Disk I/O (if iostat available)
    if command -v iostat &> /dev/null; then
        DISK_IO=$(iostat -d 1 2 | tail -n +4 | tail -1 | awk '{print $3 "," $4}')
    else
        DISK_IO="0,0"
    fi
    
    # Network I/O
    if [ -f /proc/net/dev ]; then
        NETWORK_INFO=$(cat /proc/net/dev | grep eth0 | awk '{print $2 "," $10}')
    else
        NETWORK_INFO="0,0"
    fi
    
    # API response time
    RESPONSE_START=$(date +%s%3N)
    if curl -s -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/health > /dev/null; then
        RESPONSE_END=$(date +%s%3N)
        RESPONSE_TIME=$((RESPONSE_END - RESPONSE_START))
    else
        RESPONSE_TIME="-1"
    fi
    
    # Log to CSV
    echo "${TIMESTAMP},${CPU_PERCENT},${MEMORY_INFO},${DISK_IO},${NETWORK_INFO},${RESPONSE_TIME}" >> performance_log.csv
    
    # Display current metrics
    printf "\r[%2d/%d] CPU: %s%% | Mem: %s | Response: %sms" $i $ITERATIONS $CPU_PERCENT $(echo $MEMORY_INFO | cut -d',' -f2) $RESPONSE_TIME
    
    sleep $INTERVAL
done

echo
echo
echo "Performance log saved to: performance_log.csv"
echo "Summary:"
echo "  Average response time: $(awk -F',' 'NR>1 && $9>0 {sum+=$9; count++} END {printf "%.1f", sum/count}' performance_log.csv)ms"
echo "  Max response time: $(awk -F',' 'NR>1 {if($9>max) max=$9} END {print max}' performance_log.csv)ms"
echo "  Failed requests: $(awk -F',' 'NR>1 && $9==-1 {count++} END {print count+0}' performance_log.csv)"

2.2.2 Memory Leak Detection
Memory Analysis Script:
// memory_analysis.js - Memory leak detection
const v8 = require('v8');
const fs = require('fs');

class MemoryAnalyzer {
    constructor() {
        this.snapshots = [];
        this.interval = null;
    }

    startMonitoring(intervalMs = 60000) {
        console.log('Starting memory monitoring...');
        
        this.interval = setInterval(() => {
            const snapshot = this.takeSnapshot();
            this.snapshots.push(snapshot);
            
            console.log(`Memory Snapshot ${this.snapshots.length}:`);
            console.log(`  Heap Used: ${Math.round(snapshot.heapUsed / 1024 / 1024)}MB`);
            console.log(`  Heap Total: ${Math.round(snapshot.heapTotal / 1024 / 1024)}MB`);
            console.log(`  External: ${Math.round(snapshot.external / 1024 / 1024)}MB`);
            console.log(`  RSS: ${Math.round(snapshot.rss / 1024 / 1024)}MB`);
            
            // Check for memory leaks
            if (this.snapshots.length >= 3) {
                this.analyzeLeakPattern();
            }
            
        }, intervalMs);
    }

    takeSnapshot() {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        
        return {
            timestamp: new Date().toISOString(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            heapSizeLimit: heapStats.heap_size_limit,
            totalHeapSize: heapStats.total_heap_size,
            usedHeapSize: heapStats.used_heap_size
        };
    }

    analyzeLeakPattern() {
        const recent = this.snapshots.slice(-3);
        const growthRate = [];
        
        for (let i = 1; i < recent.length; i++) {
            const growth = recent[i].heapUsed - recent[i-1].heapUsed;
            growthRate.push(growth);
        }
        
        const avgGrowth = growthRate.reduce((a, b) => a + b, 0) / growthRate.length;
        
        if (avgGrowth > 1024 * 1024) { // 1MB growth per interval
            console.warn(`⚠️ Potential memory leak detected:`);
            console.warn(`   Average growth: ${Math.round(avgGrowth / 1024)}KB per interval`);
            console.warn(`   Consider investigating memory usage patterns`);
        }
    }

    generateReport() {
        const report = {
            analysis_time: new Date().toISOString(),
            total_snapshots: this.snapshots.length,
            monitoring_duration: this.snapshots.length > 1 ? 
                new Date(this.snapshots[this.snapshots.length - 1].timestamp) - new Date(this.snapshots[0].timestamp) : 0,
            memory_trend: this.calculateTrend(),
            peak_memory: this.findPeakMemory(),
            recommendations: this.generateRecommendations()
        };
        
        fs.writeFileSync('memory_analysis_report.json', JSON.stringify(report, null, 2));
        console.log('Memory analysis report saved to: memory_analysis_report.json');
        
        return report;
    }

    calculateTrend() {
        if (this.snapshots.length < 2) return 'insufficient_data';
        
        const first = this.snapshots[0].heapUsed;
        const last = this.snapshots[this.snapshots.length - 1].heapUsed;
        const change = ((last - first) / first) * 100;
        
        if (change > 50) return 'increasing_significantly';
        if (change > 10) return 'increasing_moderately';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    findPeakMemory() {
        return Math.max(...this.snapshots.map(s => s.heapUsed));
    }

    generateRecommendations() {
        const recommendations = [];
        const trend = this.calculateTrend();
        
        if (trend.includes('increasing')) {
            recommendations.push('Monitor for potential memory leaks');
            recommendations.push('Review recent code changes for memory-intensive operations');
            recommendations.push('Consider implementing memory profiling');
        }
        
        const peakMB = Math.round(this.findPeakMemory() / 1024 / 1024);
        if (peakMB > 1000) {
            recommendations.push('Consider increasing available memory');
            recommendations.push('Optimize memory-intensive operations');
        }
        
        return recommendations;
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('Memory monitoring stopped');
        }
    }
}

// Usage
const analyzer = new MemoryAnalyzer();
analyzer.startMonitoring(30000); // Monitor every 30 seconds

// Stop monitoring after 10 minutes and generate report
setTimeout(() => {
    analyzer.stopMonitoring();
    analyzer.generateReport();
    process.exit(0);
}, 10 * 60 * 1000);


3. Authentication Issues
3.1 Token Authentication Problems
3.1.1 Invalid Token Errors
Problem: 401 Unauthorized: Invalid token
Diagnostic Steps:
# 1. Verify token format
echo "Token format check:"
if [[ $API_TOKEN =~ ^[A-Za-z0-9+/]*={0,2}$ ]]; then
    echo "✅ Token format appears valid"
else
    echo "❌ Invalid token format - should be base64-like string"
fi

# 2. Check token length
echo "Token length: ${#API_TOKEN} characters"
if [ ${#API_TOKEN} -lt 20 ]; then
    echo "⚠️ Token may be too short"
fi

# 3. Test token directly
echo "Direct token test:"
curl -v -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/health 2>&1 | grep -E "(HTTP/|Authorization|401|200)"

# 4. Check environment variables
echo "Environment check:"
echo "API_TOKEN set: $([ -n "$API_TOKEN" ] && echo "Yes" || echo "No")"
echo "API_TOKEN source: $(env | grep API_TOKEN | cut -d= -f1)"

Common Solutions:
Verify .env File:
# Check .env file exists and has correct token
if [ -f .env ]; then
    echo "✅ .env file exists"
    grep -q "API_TOKEN=" .env && echo "✅ API_TOKEN defined" || echo "❌ API_TOKEN missing"
    
    # Show token (masked)
    TOKEN_FROM_FILE=$(grep "API_TOKEN=" .env | cut -d= -f2)
    echo "Token from file: ${TOKEN_FROM_FILE:0:10}...${TOKEN_FROM_FILE: -5}"
else
    echo "❌ .env file missing"
    echo "Creating sample .env file..."
    cat > .env << EOF
API_TOKEN=your_secure_token_here_123456789
ENCRYPTION_KEY=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
PORT=3000
EOF
fi

Token Regeneration:
# Generate new secure token
NEW_TOKEN=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Generated new token: $NEW_TOKEN"

# Update .env file
sed -i "s/API_TOKEN=.*/API_TOKEN=$NEW_TOKEN/" .env
echo "✅ Updated .env file with new token"

# Restart server for changes to take effect
echo "⚠️ Remember to restart the server"

3.1.2 Token Validation Issues
Problem: Intermittent authentication failures
Advanced Diagnostics:
// token_validator.js - Debug token validation
const crypto = require('crypto');

function debugTokenValidation(token, serverToken) {
    console.log('=== Token Validation Debug ===');
    
    // Basic format validation
    console.log('1. Format Validation:');
    console.log(`   Client token length: ${token ? token.length : 'undefined'}`);
    console.log(`   Server token length: ${serverToken ? serverToken.length : 'undefined'}`);
    console.log(`   Client token type: ${typeof token}`);
    console.log(`   Server token type: ${typeof serverToken}`);
    
    if (!token) {
        console.log('❌ Client token is missing');
        return false;
    }
    
    if (!serverToken) {
        console.log('❌ Server token is missing');
        return false;
    }
    
    // Character-by-character comparison
    console.log('2. Character Comparison:');
    const minLength = Math.min(token.length, serverToken.length);
    let firstDifference = -1;
    
    for (let i = 0; i < minLength; i++) {
        if (token[i] !== serverToken[i]) {
            firstDifference = i;
            break;
        }
    }
    
    if (firstDifference >= 0) {
        console.log(`❌ Tokens differ at position ${firstDifference}`);
        console.log(`   Client: '${token.substring(firstDifference-2, firstDifference+3)}'`);
        console.log(`   Server: '${serverToken.substring(firstDifference-2, firstDifference+3)}'`);
    } else if (token.length !== serverToken.length) {
        console.log(`❌ Tokens have different lengths`);
    } else {
        console.log('✅ Tokens match exactly');
    }
    
    // Encoding validation
    console.log('3. Encoding Check:');
    console.log(`   Client token hex: ${Buffer.from(token).toString('hex').substring(0, 20)}...`);
    console.log(`   Server token hex: ${Buffer.from(serverToken).toString('hex').substring(0, 20)}...`);
    
    // Secure comparison
    console.log('4. Secure Comparison:');
    try {
        const clientBuffer = Buffer.from(token);
        const serverBuffer = Buffer.from(serverToken);
        const isEqual = crypto.timingSafeEqual(clientBuffer, serverBuffer);
        console.log(`   Timing-safe equal: ${isEqual}`);
        return isEqual;
    } catch (error) {
        console.log(`❌ Secure comparison failed: ${error.message}`);
        return false;
    }
}

// Usage example
const clientToken = process.env.API_TOKEN;
const serverToken = process.env.API_TOKEN; // In real scenario, this comes from server config
debugTokenValidation(clientToken, serverToken);

3.2 Session Management Issues
3.2.1 Session Timeout Problems
Problem: Users getting logged out unexpectedly
Session Diagnostics:
// session_debugger.js
const express = require('express');

class SessionDebugger {
    constructor() {
        this.sessions = new Map();
    }

    trackSession(sessionId, userData) {
        const sessionInfo = {
            id: sessionId,
            user: userData,
            createdAt: new Date(),
            lastActivity: new Date(),
            requestCount: 0,
            ipAddresses: new Set(),
            userAgents: new Set()
        };
        
        this.sessions.set(sessionId, sessionInfo);
        console.log(`📝 Session created: ${sessionId}`);
    }

    updateSessionActivity(sessionId, req) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
            session.requestCount++;
            session.ipAddresses.add(req.ip);
            session.userAgents.add(req.get('User-Agent'));
            
            // Check for suspicious activity
            if (session.ipAddresses.size > 3) {
                console.warn(`⚠️ Multiple IPs for session ${sessionId}: ${Array.from(session.ipAddresses).join(', ')}`);
            }
        }
    }

    checkSessionHealth(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { status: 'not_found' };
        }

        const now = new Date();
        const sessionAge = now - session.createdAt;
        const timeSinceActivity = now - session.lastActivity;
        const isExpired = timeSinceActivity > 3600000; // 1 hour

        return {
            status: isExpired ? 'expired' : 'active',
            age_minutes: Math.round(sessionAge / 60000),
            inactive_minutes: Math.round(timeSinceActivity / 60000),
            request_count: session.requestCount,
            ip_count: session.ipAddresses.size,
            last_ip: Array.from(session.ipAddresses).pop()
        };
    }

    generateSessionReport() {
        const report = {
            total_sessions: this.sessions.size,
            active_sessions: 0,
            expired_sessions: 0,
            session_details: []
        };

        for (const [sessionId, session] of this.sessions) {
            const health = this.checkSessionHealth(sessionId);
            
            if (health.status === 'active') {
                report.active_sessions++;
            } else {
                report.expired_sessions++;
            }

            report.session_details.push({
                id: sessionId.substring(0, 8) + '...',
                status: health.status,
                age_minutes: health.age_minutes,
                inactive_minutes: health.inactive_minutes,
                requests: health.request_count
            });
        }

        return report;
    }

    cleanup() {
        const now = new Date();
        let cleaned = 0;
        
        for (const [sessionId, session] of this.sessions) {
            const timeSinceActivity = now - session.lastActivity;
            if (timeSinceActivity > 3600000) { // 1 hour
                this.sessions.delete(sessionId);
                cleaned++;
                console.log(`🧹 Cleaned expired session: ${sessionId}`);
            }
        }
        
        return cleaned;
    }
}

// Usage
const debugger = new SessionDebugger();

// Middleware to track sessions
function sessionTracker(req, res, next) {
    const sessionId = req.headers['x-session-id'] || req.ip + '-' + Date.now();
    
    if (!debugger.sessions.has(sessionId)) {
        debugger.trackSession(sessionId, { ip: req.ip });
    }
    
    debugger.updateSessionActivity(sessionId, req);
    req.sessionDebugger = debugger;
    req.sessionId = sessionId;
    
    next();
}

// Endpoint to get session info
app.get('/debug/session', (req, res) => {
    const health = req.sessionDebugger.checkSessionHealth(req.sessionId);
    res.json(health);
});

// Periodic cleanup
setInterval(() => {
    const cleaned = debugger.cleanup();
    if (cleaned > 0) {
        console.log(`🧹 Session cleanup: removed ${cleaned} expired sessions`);
    }
}, 300000); // Every 5 minutes


4. Profile Management Problems
4.1 Profile Creation Issues
4.1.1 Validation Errors
Problem: Profile creation fails with validation errors
Validation Debugger:
// profile_validator.js
class ProfileValidator {
    constructor() {
        this.requiredFields = {
            user: ['user_id', 'canonical_name'],
            agent: ['agent_id', 'name', 'core_role']
        };
        
        this.fieldValidators = {
            user_id: (value) => this.validateId(value),
            agent_id: (value) => this.validateId(value),
            canonical_name: (value) => this.validateName(value),
            name: (value) => this.validateName(value),
            core_role: (value) => this.validateRole(value),
            interaction_preferences: (value) => this.validateJSON(value),
            expertise_areas: (value) => this.validateArray(value)
        };
    }

    validateProfile(type, profileData) {
        const errors = [];
        const warnings = [];
        
        console.log(`=== Validating ${type} profile ===`);
        
        // Check required fields
        const required = this.requiredFields[type] || [];
        for (const field of required) {
            if (!profileData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        // Validate individual fields
        for (const [field, value] of Object.entries(profileData)) {
            if (this.fieldValidators[field]) {
                const result = this.fieldValidators[field](value);
                if (result.errors.length > 0) {
                    errors.push(...result.errors.map(e => `${field}: ${e}`));
                }
                if (result.warnings.length > 0) {
                    warnings.push(...result.warnings.map(w => `${field}: ${w}`));
                }
            }
        }
        
        // Data structure validation
        if (profileData.interaction_preferences) {
            const prefResult = this.validateInteractionPreferences(profileData.interaction_preferences);
            errors.push(...prefResult.errors);
            warnings.push(...prefResult.warnings);
        }
        
        return { errors, warnings, isValid: errors.length === 0 };
    }

    validateId(value) {
        const errors = [];
        const warnings = [];
        
        if (!value || typeof value !== 'string') {
            errors.push('Must be a non-empty string');
        } else {
            if (value.length < 3) {
                errors.push('Must be at least 3 characters long');
            }
            if (value.length > 50) {
                errors.push('Must not exceed 50 characters');
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                errors.push('Can only contain letters, numbers, underscores, and hyphens');
            }
            if (/^[-_]/.test(value) || /[-_]$/.test(value)) {
                warnings.push('Should not start or end with underscore or hyphen');
            }
        }
        
        return { errors, warnings };
    }

    validateName(value) {
        const errors = [];
        const warnings = [];
        
        if (!value || typeof value !== 'string') {
            errors.push('Must be a non-empty string');
        } else {
            if (value.length < 2) {
                errors.push('Must be at least 2 characters long');
            }
            if (value.length > 100) {
                errors.push('Must not exceed 100 characters');
            }
            if (value.trim() !== value) {
                warnings.push('Has leading or trailing whitespace');
            }
        }
        
        return { errors, warnings };
    }

    validateRole(value) {
        const errors = [];
        const warnings = [];
        const validRoles = [
            'analyst', 'developer', 'researcher', 'writer', 'reviewer',
            'coordinator', 'specialist', 'manager', 'consultant'
        ];
        
        if (!value || typeof value !== 'string') {
            errors.push('Must be a non-empty string');
        } else {
            if (!validRoles.includes(value.toLowerCase())) {
                warnings.push(`Uncommon role type. Suggested: ${validRoles.join(', ')}`);
            }
        }
        
        return { errors, warnings };
    }

    validateJSON(value) {
        const errors = [];
        const warnings = [];
        
        if (typeof value === 'string') {
            try {
                JSON.parse(value);
            } catch (e) {
                errors.push('Invalid JSON format');
            }
        } else if (typeof value === 'object' && value !== null) {
            // Valid object, no issues
        } else if (value !== undefined) {
            errors.push('Must be a valid JSON object or string');
        }
        
        return { errors, warnings };
    }

    validateArray(value) {
        const errors = [];
        const warnings = [];
        
        if (value !== undefined) {
            if (!Array.isArray(value)) {
                errors.push('Must be an array');
            } else {
                if (value.length === 0) {
                    warnings.push('Empty array - consider adding items');
                }
                if (value.length > 20) {
                    warnings.push('Very large array - consider consolidation');
                }
            }
        }
        
        return { errors, warnings };
    }

    validateInteractionPreferences(prefs) {
        const errors = [];
        const warnings = [];
        const validValues = {
            formality: ['casual', 'professional', 'technical'],
            depth: ['brief', 'standard', 'detailed', 'comprehensive'],
            response_style: ['direct', 'analytical', 'conversational', 'structured']
        };
        
        for (const [key, value] of Object.entries(prefs)) {
            if (validValues[key] && !validValues[key].includes(value)) {
                warnings.push(`${key}: unusual value '${value}'. Suggested: ${validValues[key].join(', ')}`);
            }
        }
        
        return { errors, warnings };
    }

    generateValidationReport(type, profileData) {
        const result = this.validateProfile(type, profileData);
        
        console.log(`\n=== Validation Report ===`);
        console.log(`Profile Type: ${type}`);
        console.log(`Valid: ${result.isValid ? '✅ Yes' : '❌ No'}`);
        
        if (result.errors.length > 0) {
            console.log(`\nErrors (${result.errors.length}):`);
            result.errors.forEach((error, i) => {
                console.log(`  ${i + 1}. ❌ ${error}`);
            });
        }
        
        if (result.warnings.length > 0) {
            console.log(`\nWarnings (${result.warnings.length}):`);
            result.warnings.forEach((warning, i) => {
                console.log(`  ${i + 1}. ⚠️ ${warning}`);
            });
        }
        
        if (result.isValid && result.warnings.length === 0) {
            console.log(`\n✅ Profile validation passed with no issues!`);
        }
        
        return result;
    }
}

// Usage example
const validator = new ProfileValidator();

// Test profile data
const testProfile = {
    user_id: 'test_user_123',
    canonical_name: 'Test User',
    interaction_preferences: {
        formality: 'professional',
        depth: 'detailed'
    },
    expertise_areas: ['testing', 'validation']
};

const result = validator.generateValidationReport('user', testProfile);

4.1.2 Duplicate Profile Detection
Problem: Profile creation fails due to duplicate IDs
Duplicate Detection Script:
#!/bin/bash
# duplicate_profile_check.sh

DB_FILE="vault.db"
PROFILE_TYPE="$1"
PROFILE_ID="$2"

if [ -z "$PROFILE_TYPE" ] || [ -z "$PROFILE_ID" ]; then
    echo "Usage: $0 <user|agent> <profile_id>"
    exit 1
fi

echo "=== Duplicate Profile Check ==="
echo "Type: $PROFILE_TYPE"
echo "ID: $PROFILE_ID"
echo

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database file not found: $DB_FILE"
    exit 1
fi

# Check table structure
echo "1. Database Structure:"
TABLES=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table';")
echo "   Tables: $TABLES"

# Check for existing profile
echo "2. Profile Existence Check:"
if echo "$TABLES" | grep -q "profiles"; then
    EXISTING_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles WHERE type='$PROFILE_TYPE' AND profile_id='$PROFILE_ID';")
    
    if [ "$EXISTING_COUNT" -gt 0 ]; then
        echo "❌ Profile already exists!"
        echo "   Found $EXISTING_COUNT matching record(s)"
        
        # Get details of existing profile
        echo "3. Existing Profile Details:"
        sqlite3 "$DB_FILE" "SELECT profile_id, type, created_at, updated_at FROM profiles WHERE type='$PROFILE_TYPE' AND profile_id='$PROFILE_ID';" | while IFS='|' read -r id type created updated; do
            echo "   ID: $id"
            echo "   Type: $type"
            echo "   Created: $created"
            echo "   Updated: $updated"
        done
        
        # Suggest alternatives
        echo "4. Suggested Alternatives:"
        SIMILAR_IDS=$(sqlite3 "$DB_FILE" "SELECT profile_id FROM profiles WHERE type='$PROFILE_TYPE' AND profile_id LIKE '$PROFILE_ID%' ORDER BY profile_id;")
        
        if [ -n "$SIMILAR_IDS" ]; then
            echo "   Existing similar IDs:"
            echo "$SIMILAR_IDS" | sed 's/^/   - /'
            
            # Generate new ID suggestions
            echo "   Suggested new IDs:"
            echo "   - ${PROFILE_ID}_v2"
            echo "   - ${PROFILE_ID}_$(date +%Y%m%d)"
            echo "   - ${PROFILE_ID}_new"
        fi
        
    else
        echo "✅ Profile ID is available"
    fi
else
    echo "⚠️ Profiles table does not exist - database may need initialization"
fi

# Check for soft-deleted profiles
echo "5. Soft-Deleted Profile Check:"
DELETED_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles WHERE type='$PROFILE_TYPE' AND profile_id='$PROFILE_ID' AND deleted=1;" 2>/dev/null || echo "0")

if [ "$DELETED_COUNT" -gt 0 ]; then
    echo "⚠️ Found $DELETED_COUNT soft-deleted profile(s) with this ID"
    echo "   Consider using hard delete or restoring the existing profile"
    
    sqlite3 "$DB_FILE" "SELECT profile_id, deleted_at FROM profiles WHERE type='$PROFILE_TYPE' AND profile_id='$PROFILE_ID' AND deleted=1;" | while IFS='|' read -r id deleted_at; do
        echo "   Deleted: $deleted_at"
    done
fi

echo
echo "=== Check Complete ==="

4.2 Profile Retrieval Issues
4.2.1 Profile Not Found Errors
Problem: Cannot retrieve existing profiles
Profile Discovery Script:
#!/bin/bash
# profile_discovery.sh

DB_FILE="vault.db"
SEARCH_TERM="$1"

echo "=== Profile Discovery Tool ==="

if [ -z "$SEARCH_TERM" ]; then
    echo "Usage: $0 <search_term>"
    echo "  Searches for profiles by ID, name, or content"
    echo
    echo "Examples:"
    echo "  $0 alice"
    echo "  $0 researcher"
    echo "  $0 '%test%'"
    exit 1
fi

# Database existence check
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database not found: $DB_FILE"
    exit 1
fi

echo "Searching for: '$SEARCH_TERM'"
echo

# Search by profile ID
echo "1. Profile ID Search:"
PROFILE_ID_RESULTS=$(sqlite3 "$DB_FILE" "SELECT type, profile_id, created_at FROM profiles WHERE profile_id LIKE '%$SEARCH_TERM%' ORDER BY created_at DESC;" 2>/dev/null)

if [ -n "$PROFILE_ID_RESULTS" ]; then
    echo "$PROFILE_ID_RESULTS" | while IFS='|' read -r type id created; do
        echo "   ✅ $type: $id (created: $created)"
    done
else
    echo "   No profiles found with ID containing '$SEARCH_TERM'"
fi
echo

# Search by profile content (JSON)
echo "2. Profile Content Search:"
CONTENT_RESULTS=$(sqlite3 "$DB_FILE" "SELECT type, profile_id, json_extract(data, '$.canonical_name') as name FROM profiles WHERE data LIKE '%$SEARCH_TERM%' ORDER BY created_at DESC LIMIT 10;" 2>/dev/null)

if [ -n "$CONTENT_RESULTS" ]; then
    echo "$CONTENT_RESULTS" | while IFS='|' read -r type id name; do
        echo "   ✅ $type: $id${name:+ ($name)}"
    done
else
    echo "   No profiles found with content containing '$SEARCH_TERM'"
fi
echo

# Show profile statistics
echo "3. Profile Statistics:"
USER_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles WHERE type='user';" 2>/dev/null || echo "0")
AGENT_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles WHERE type='agent';" 2>/dev/null || echo "0")
DELETED_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles WHERE deleted=1;" 2>/dev/null || echo "0")

echo "   User profiles: $USER_COUNT"
echo "   Agent profiles: $AGENT_COUNT"
echo "   Deleted profiles: $DELETED_COUNT"
echo "   Total profiles: $((USER_COUNT + AGENT_COUNT))"

# Recent profiles
echo
echo "4. Recent Profiles (Last 10):"
RECENT_PROFILES=$(sqlite3 "$DB_FILE" "SELECT type, profile_id, created_at FROM profiles WHERE deleted IS NULL OR deleted=0 ORDER BY created_at DESC LIMIT 10;" 2>/dev/null)

if [ -n "$RECENT_PROFILES" ]; then
    echo "$RECENT_PROFILES" | while IFS='|' read -r type id created; do
        echo "   $type: $id ($created)"
    done
else
    echo "   No profiles found"
fi

# Database integrity check
echo
echo "5. Database Integrity:"
INTEGRITY_RESULT=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null)
if [ "$INTEGRITY_RESULT" = "ok" ]; then
    echo "   ✅ Database integrity: OK"
else
    echo "   ❌ Database integrity issues detected:"
    echo "   $INTEGRITY_RESULT"
fi

echo
echo "=== Discovery Complete ==="


5. Agent Orchestration Issues
5.1 Orchestration Startup Problems
5.1.1 Agent Configuration Errors
Problem: Agent orchestration fails to start
Agent Configuration Validator:
// agent_config_validator.js
class AgentConfigValidator {
    constructor() {
        this.requiredAgentFields = ['agent_id', 'role'];
        this.validRoles = [
            'data_analyst', 'report_writer', 'code_reviewer', 
            'researcher', 'coordinator', 'specialist'
        ];
        this.validCapabilities = [
            'data_processing', 'text_generation', 'code_analysis',
            'research', 'visualization', 'coordination'
        ];
    }

    validateOrchestrationConfig(config) {
        console.log('=== Agent Orchestration Validation ===');
        
        const errors = [];
        const warnings = [];

        // Basic structure validation
        if (!config.teamId) {
            errors.push('Missing teamId');
        } else if (typeof config.teamId !== 'string' || config.teamId.length < 3) {
            errors.push('teamId must be a string with at least 3 characters');
        }

        if (!config.agents || !Array.isArray(config.agents)) {
            errors.push('agents must be an array');
        } else if (config.agents.length === 0) {
            errors.push('agents array cannot be empty');
        }

        if (!config.tasks || !Array.isArray(config.tasks)) {
            errors.push('tasks must be an array');
        } else if (config.tasks.length === 0) {
            errors.push('tasks array cannot be empty');
        }

        // Agent validation
        if (config.agents) {
            config.agents.forEach((agent, index) => {
                const agentErrors = this.validateAgent(agent, index);
                errors.push(...agentErrors.errors);
                warnings.push(...agentErrors.warnings);
            });

            // Check for duplicate agent IDs
            const agentIds = config.agents.map(a => a.agent_id).filter(Boolean);
            const duplicates = agentIds.filter((id, i) => agentIds.indexOf(id) !== i);
            if (duplicates.length > 0) {
                errors.push(`Duplicate agent IDs found: ${duplicates.join(', ')}`);
            }
        }

        // Task validation
        if (config.tasks) {
            config.tasks.forEach((task, index) => {
                if (!task || typeof task !== 'string' || task.trim().length === 0) {
                    errors.push(`Task ${index + 1}: must be a non-empty string`);
                }
            });
        }

        // Configuration validation
        if (config.configuration) {
            const configErrors = this.validateConfiguration(config.configuration);
            errors.push(...configErrors.errors);
            warnings.push(...configErrors.warnings);
        }

        const result = {
            isValid: errors.length === 0,
            errors,
            warnings,
            summary: this.generateValidationSummary(config, errors, warnings)
        };

        this.printValidationReport(result);
        return result;
    }

    validateAgent(agent, index) {
        const errors = [];
        const warnings = [];
        const prefix = `Agent ${index + 1}`;

        // Required fields
        this.requiredAgentFields.forEach(field => {
            if (!agent[field]) {
                errors.push(`${prefix}: Missing required field '${field}'`);
            }
        });

        // Agent ID validation
        if (agent.agent_id) {
            if (typeof agent.agent_id !== 'string') {
                errors.push(`${prefix}: agent_id must be a string`);
            } else if (!/^[a-zA-Z0-9_-]+$/.test(agent.agent_id)) {
                errors.push(`${prefix}: agent_id contains invalid characters`);
            }
        }

        // Role validation
        if (agent.role && !this.validRoles.includes(agent.role)) {
            warnings.push(`${prefix}: Uncommon role '${agent.role}'. Suggested: ${this.validRoles.join(', ')}`);
        }

        // Capabilities validation
        if (agent.capabilities) {
            if (!Array.isArray(agent.capabilities)) {
                errors.push(`${prefix}: capabilities must be an array`);
            } else {
                agent.capabilities.forEach(cap => {
                    if (!this.validCapabilities.includes(cap)) {
                        warnings.push(`${prefix}: Uncommon capability '${cap}'`);
                    }
                });
            }
        }

        // Resource validation
        if (agent.resources) {
            if (agent.resources.max_memory) {
                const memoryRegex = /^\d+(MB|GB|KB)$/i;
                if (!memoryRegex.test(agent.resources.max_memory)) {
                    errors.push(`${prefix}: max_memory must be in format like '512MB' or '1GB'`);
                }
            }
            
            if (agent.resources.max_cpu_percent) {
                const cpu = parseInt(agent.resources.max_cpu_percent);
                if (isNaN(cpu) || cpu < 1 || cpu > 100) {
                    errors.push(`${prefix}: max_cpu_percent must be between 1 and 100`);
                }
            }
        }

        return { errors, warnings };
    }

    validateConfiguration(config) {
        const errors = [];
        const warnings = [];

        const validExecutionModes = ['sequential', 'parallel', 'pipeline'];
        if (config.execution_mode && !validExecutionModes.includes(config.execution_mode)) {
            errors.push(`Invalid execution_mode. Valid options: ${validExecutionModes.join(', ')}`);
        }

        if (config.timeout_minutes) {
            const timeout = parseInt(config.timeout_minutes);
            if (isNaN(timeout) || timeout < 1) {
                errors.push('timeout_minutes must be a positive number');
            } else if (timeout > 1440) { // 24 hours
                warnings.push('timeout_minutes is very high (>24 hours) - consider reducing');
            }
        }

        if (typeof config.parallel_tasks !== 'undefined' && typeof config.parallel_tasks !== 'boolean') {
            errors.push('parallel_tasks must be a boolean value');
        }

        if (typeof config.auto_recovery !== 'undefined' && typeof config.auto_recovery !== 'boolean') {
            errors.push('auto_recovery must be a boolean value');
        }

        return { errors, warnings };
    }

    generateValidationSummary(config, errors, warnings) {
        return {
            teamId: config.teamId,
            agentCount: config.agents ? config.agents.length : 0,
            taskCount: config.tasks ? config.tasks.length : 0,
            errorCount: errors.length,
            warningCount: warnings.length,
            estimatedComplexity: this.calculateComplexity(config)
        };
    }

    calculateComplexity(config) {
        let complexity = 0;
        
        if (config.agents) {
            complexity += config.agents.length * 2; // Base complexity per agent
            
            // Add complexity for capabilities
            config.agents.forEach(agent => {
                if (agent.capabilities) {
                    complexity += agent.capabilities.length;
                }
            });
        }
        
        if (config.tasks) {
            complexity += config.tasks.length;
        }
        
        if (config.configuration && config.configuration.execution_mode === 'parallel') {
            complexity *= 1.5; // Parallel execution adds complexity
        }

        if (complexity < 10) return 'low';
        if (complexity < 25) return 'medium';
        if (complexity < 50) return 'high';
        return 'very_high';
    }

    printValidationReport(result) {
        console.log('\n=== Validation Report ===');
        console.log(`Team ID: ${result.summary.teamId}`);
        console.log(`Agents: ${result.summary.agentCount}`);
        console.log(`Tasks: ${result.summary.taskCount}`);
        console.log(`Complexity: ${result.summary.estimatedComplexity}`);
        console.log(`Valid: ${result.isValid ? '✅ Yes' : '❌ No'}`);

        if (result.errors.length > 0) {
            console.log(`\nErrors (${result.errors.length}):`);
            result.errors.forEach((error, i) => {
                console.log(`  ${i + 1}. ❌ ${error}`);
            });
        }

        if (result.warnings.length > 0) {
            console.log(`\nWarnings (${result.warnings.length}):`);
            result.warnings.forEach((warning, i) => {
                console.log(`  ${i + 1}. ⚠️ ${warning}`);
            });
        }

        if (result.isValid) {
            console.log('\n✅ Configuration is valid and ready for orchestration!');
            
            if (result.summary.estimatedComplexity === 'very_high') {
                console.log('⚠️ High complexity detected - consider breaking into smaller teams');
            }
        } else {
            console.log('\n❌ Configuration has errors that must be fixed before orchestration');
        }
    }

    async validateAgentProfiles(agentIds) {
        console.log('\n=== Agent Profile Validation ===');
        
        const results = [];
        
        for (const agentId of agentIds) {
            try {
                const response = await fetch(`http://localhost:3000/profiles/agent/${agentId}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.API_TOKEN}`
                    }
                });
                
                if (response.ok) {
                    const profile = await response.json();
                    results.push({
                        agentId,
                        status: 'found',
                        profile: profile
                    });
                    console.log(`✅ Agent ${agentId}: Profile found`);
                } else {
                    results.push({
                        agentId,
                        status: 'not_found',
                        error: response.statusText
                    });
                    console.log(`❌ Agent ${agentId}: Profile not found (${response.status})`);
                }
                
            } catch (error) {
                results.push({
                    agentId,
                    status: 'error',
                    error: error.message
                });
                console.log(`❌ Agent ${agentId}: Error - ${error.message}`);
            }
        }
        
        return results;
    }
}

// Usage example
const validator = new AgentConfigValidator();

const testConfig = {
    teamId: 'test_team_123',
    agents: [
        {
            agent_id: 'analyst_v1',
            role: 'data_analyst',
            capabilities: ['data_processing', 'visualization'],
            resources: {
                max_memory: '1GB',
                max_cpu_percent: 50
            }
        },
        {
            agent_id: 'writer_v1',
            role: 'report_writer',
            capabilities: ['text_generation']
        }
    ],
    tasks: [
        'Analyze dataset',
        'Generate report'
    ],
    configuration: {
        execution_mode: 'sequential',
        timeout_minutes: 60,
        auto_recovery: true
    }
};

// Validate configuration
const result = validator.validateOrchestrationConfig(testConfig);

// Validate agent profiles exist
if (result.isValid) {
    const agentIds = testConfig.agents.map(a => a.agent_id);
    validator.validateAgentProfiles(agentIds);
}

5.1.2 Resource Allocation Problems
Problem: Agents fail to start due to resource constraints
Resource Monitor:
#!/bin/bash
# resource_monitor.sh - Monitor system resources for agent orchestration

echo "=== System Resource Monitor ==="
echo "Timestamp: $(date)"
echo

# Function to convert memory values to MB
to_mb() {
    local value=$1
    local unit=${value: -2}
    local num=${value%??}
    
    case $unit in
        GB) echo $(($num * 1024)) ;;
        MB) echo $num ;;
        KB) echo $(($num / 1024)) ;;
        *) echo $value ;;
    esac
}

# Check available resources
echo "1. System Resources:"
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
USED_MEM=$(free -m | awk 'NR==2{print $3}')
FREE_MEM=$(free -m | awk 'NR==2{print $4}')
AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')

echo "   Memory Total: ${TOTAL_MEM}MB"
echo "   Memory Used: ${USED_MEM}MB ($(($USED_MEM * 100 / $TOTAL_MEM))%)"
echo "   Memory Available: ${AVAILABLE_MEM}MB"

CPU_COUNT=$(nproc)
LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}')
echo "   CPU Cores: $CPU_COUNT"
echo "   Load Average: $LOAD_AVERAGE"

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAILABLE=$(df -h . | awk 'NR==2 {print $4}')
echo "   Disk Usage: ${DISK_USAGE}%"
echo "   Disk Available: $DISK_AVAILABLE"
echo

# Analyze agent resource requirements
echo "2. Agent Resource Analysis:"
if [ -f "agent_config.json" ]; then
    echo "   Configuration file: ✅ Found"
    
    # Extract resource requirements using jq if available
    if command -v jq &> /dev/null; then
        AGENT_COUNT=$(jq '.agents | length' agent_config.json 2>/dev/null || echo "0")
        echo "   Configured agents: $AGENT_COUNT"
        
        TOTAL_MEMORY_REQUIRED=0
        TOTAL_CPU_REQUIRED=0
        
        jq -r '.agents[] | "\(.agent_id):\(.resources.max_memory // "512MB"):\(.resources.max_cpu_percent // 25)"' agent_config.json 2>/dev/null | while IFS=':' read -r agent_id memory cpu; do
            MEMORY_MB=$(to_mb $memory)
            echo "   Agent $agent_id: ${MEMORY_MB}MB RAM, ${cpu}% CPU"
            
            TOTAL_MEMORY_REQUIRED=$((TOTAL_MEMORY_REQUIRED + MEMORY_MB))
            TOTAL_CPU_REQUIRED=$((TOTAL_CPU_REQUIRED + cpu))
        done
        
        # Check if resources are sufficient
        echo "   Total required memory: ${TOTAL_MEMORY_REQUIRED}MB"
        echo "   Total required CPU: ${TOTAL_CPU_REQUIRED}%"
        
        if [ $TOTAL_MEMORY_REQUIRED -gt $AVAILABLE_MEM ]; then
            echo "   ❌ Insufficient memory! Need ${TOTAL_MEMORY_REQUIRED}MB, have ${AVAILABLE_MEM}MB"
        else
            echo "   ✅ Memory requirements satisfied"
        fi
        
        if [ $TOTAL_CPU_REQUIRED -gt 100 ]; then
            echo "   ⚠️ CPU requirements exceed 100% - agents will compete for resources"
        else
            echo "   ✅ CPU requirements within limits"
        fi
        
    else
        echo "   ⚠️ jq not available - install for detailed analysis"
    fi
else
    echo "   ❌ No agent configuration file found"
fi
echo

# Check for resource-intensive processes
echo "3. Resource-Intensive Processes:"
echo "   Top memory consumers:"
ps aux --sort=-%mem | head -6 | awk '{printf "   %-20s %6s %6s %s\n", $1, $3, $4, $11}'

echo "   Top CPU consumers:"
ps aux --sort=-%cpu | head -6 | awk '{printf "   %-20s %6s %6s %s\n", $1, $3, $4, $11}'
echo

# Resource recommendations
echo "4. Recommendations:"
if [ $DISK_USAGE -gt 90 ]; then
    echo "   ❌ Free up disk space (currently ${DISK_USAGE}% full)"
fi

if [ $USED_MEM -gt $((TOTAL_MEM * 80 / 100)) ]; then
    echo "   ⚠️ High memory usage - consider adding more RAM or reducing agent memory limits"
fi

if [ $(echo "$LOAD_AVERAGE" | awk '{print ($1 > 2.0) ? 1 : 0}') -eq 1 ]; then
    echo "   ⚠️ High system load - consider reducing concurrent agents"
fi

echo "   ✅ Monitor resources during orchestration"
echo "   ✅ Consider implementing resource limits in agent configuration"
echo

echo "=== Resource Monitor Complete ==="

5.2 Agent Communication Issues
5.2.1 Inter-Agent Communication Failures
Problem: Agents cannot communicate with each other
Communication Diagnostics:
// agent_communication_debugger.js
class AgentCommunicationDebugger {
    constructor() {
        this.communicationLog = [];
        this.agents = new Map();
        this.messageQueue = new Map();
    }

    registerAgent(agentId, endpoint, status = 'active') {
        this.agents.set(agentId, {
            id: agentId,
            endpoint: endpoint,
            status: status,
            lastHeartbeat: new Date(),
            messagesSent: 0,
            messagesReceived: 0,
            errors: []
        });
        
        console.log(`📝 Agent registered: ${agentId} at ${endpoint}`);
    }

    async testAgentConnectivity(agentId) {
        console.log(`🔍 Testing connectivity for agent: ${agentId}`);
        
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.log(`❌ Agent ${agentId} not registered`);
            return false;
        }

        try {
            // Test agent endpoint
            const response = await fetch(`${agent.endpoint}/health`, {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                const healthData = await response.json();
                console.log(`✅ Agent ${agentId} is healthy`);
                console.log(`   Status: ${healthData.status}`);
                console.log(`   Response time: ${response.headers.get('response-time') || 'N/A'}`);
                
                agent.lastHeartbeat = new Date();
                agent.status = 'active';
                return true;
            } else {
                console.log(`❌ Agent ${agentId} returned status: ${response.status}`);
                agent.status = 'unhealthy';
                return false;
            }
        } catch (error) {
            console.log(`❌ Agent ${agentId} connectivity failed: ${error.message}`);
            agent.status = 'unreachable';
            agent.errors.push({
                timestamp: new Date(),
                error: error.message,
                type: 'connectivity'
            });
            return false;
        }
    }

    async testInterAgentCommunication(senderAgentId, receiverAgentId, testMessage) {
        console.log(`🔄 Testing communication: ${senderAgentId} → ${receiverAgentId}`);
        
        const sender = this.agents.get(senderAgentId);
        const receiver = this.agents.get(receiverAgentId);
        
        if (!sender || !receiver) {
            console.log(`❌ One or both agents not registered`);
            return false;
        }

        const communicationId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const message = {
            id: communicationId,
            from: senderAgentId,
            to: receiverAgentId,
            payload: testMessage || { type: 'test', content: 'connectivity test' },
            timestamp: new Date().toISOString(),
            timeout: 10000
        };

        try {
            // Send message to receiver via sender
            const response = await fetch(`${sender.endpoint}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Target-Agent': receiverAgentId,
                    'X-Message-Id': communicationId
                },
                body: JSON.stringify(message),
                timeout: 10000
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Message sent successfully`);
                console.log(`   Message ID: ${communicationId}`);
                console.log(`   Delivery time: ${result.deliveryTime || 'N/A'}ms`);
                
                sender.messagesSent++;
                this.logCommunication(message, 'sent', true);
                
                // Wait for acknowledgment
                const ackReceived = await this.waitForAcknowledgment(communicationId, 5000);
                if (ackReceived) {
                    receiver.messagesReceived++;
                    console.log(`✅ Message acknowledged by receiver`);
                    return true;
                } else {
                    console.log(`⚠️ Message sent but no acknowledgment received`);
                    return false;
                }
            } else {
                console.log(`❌ Failed to send message: ${response.status} ${response.statusText}`);
                this.logCommunication(message, 'sent', false, response.statusText);
                return false;
            }
        } catch (error) {
            console.log(`❌ Communication error: ${error.message}`);
            this.logCommunication(message, 'sent', false, error.message);
            return false;
        }
    }

    waitForAcknowledgment(messageId, timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkAck = () => {
                const ack = this.communicationLog.find(log => 
                    log.messageId === messageId && log.type === 'acknowledgment'
                );
                
                if (ack) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    resolve(false);
                } else {
                    setTimeout(checkAck, 100);
                }
            };
            
            checkAck();
        });
    }

    logCommunication(message, type, success, error = null) {
        const logEntry = {
            timestamp: new Date(),
            messageId: message.id,
            from: message.from,
            to: message.to,
            type: type, // 'sent', 'received', 'acknowledgment'
            success: success,
            error: error,
            payload: message.payload
        };
        
        this.communicationLog.push(logEntry);
    }

    async runFullCommunicationTest(teamConfig) {
        console.log('\n=== Full Communication Test ===');
        
        const agents = teamConfig.agents || [];
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;

        // Register all agents
        for (const agent of agents) {
            this.registerAgent(
                agent.agent_id,
                `http://localhost:${3000 + agents.indexOf(agent)}`, // Mock endpoints
                'registered'
            );
        }

        // Test individual agent connectivity
        console.log('\n1. Individual Agent Connectivity:');
        for (const agent of agents) {
            totalTests++;
            const isConnected = await this.testAgentConnectivity(agent.agent_id);
            if (isConnected) {
                passedTests++;
            } else {
                failedTests++;
            }
        }

        // Test inter-agent communication (all pairs)
        console.log('\n2. Inter-Agent Communication:');
        for (let i = 0; i < agents.length; i++) {
            for (let j = 0; j < agents.length; j++) {
                if (i !== j) {
                    totalTests++;
                    const canCommunicate = await this.testInterAgentCommunication(
                        agents[i].agent_id,
                        agents[j].agent_id
                    );
                    if (canCommunicate) {
                        passedTests++;
                    } else {
                        failedTests++;
                    }
                }
            }
        }

        // Generate communication report
        console.log('\n3. Communication Report:');
        console.log(`   Total tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
        console.log(`   Failed: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
        
        if (failedTests === 0) {
            console.log('   ✅ All communication tests passed!');
        } else if (failedTests > totalTests / 2) {
            console.log('   ❌ Majority of tests failed - check network and agent configurations');
        } else {
            console.log('   ⚠️ Some tests failed - check specific agent configurations');
        }

        return {
            totalTests,
            passedTests,
            failedTests,
            successRate: passedTests / totalTests,
            communicationLog: this.communicationLog,
            agentStatus: Array.from(this.agents.values())
        };
    }

    generateTroubleshootingReport() {
        console.log('\n=== Communication Troubleshooting Report ===');
        
        // Agent status summary
        console.log('1. Agent Status Summary:');
        for (const [agentId, agent] of this.agents) {
            console.log(`   ${agentId}:`);
            console.log(`     Status: ${agent.status}`);
            console.log(`     Messages sent: ${agent.messagesSent}`);
            console.log(`     Messages received: ${agent.messagesReceived}`);
            console.log(`     Last heartbeat: ${agent.lastHeartbeat.toLocaleTimeString()}`);
            
            if (agent.errors.length > 0) {
                console.log(`     Recent errors: ${agent.errors.length}`);
                agent.errors.slice(-3).forEach(error => {
                    console.log(`       - ${error.timestamp.toLocaleTimeString()}: ${error.error}`);
                });
            }
        }

        // Communication patterns
        console.log('\n2. Communication Patterns:');
        const patterns = this.analyzeCommunicationPatterns();
        Object.entries(patterns).forEach(([pattern, count]) => {
            console.log(`   ${pattern}: ${count} occurrences`);
        });

        // Recommendations
        console.log('\n3. Troubleshooting Recommendations:');
        this.generateRecommendations().forEach(recommendation => {
            console.log(`   ${recommendation}`);
        });
    }

    analyzeCommunicationPatterns() {
        const patterns = {};
        
        this.communicationLog.forEach(log => {
            const pattern = `${log.from} → ${log.to}`;
            patterns[pattern] = (patterns[pattern] || 0) + 1;
        });
        
        return patterns;
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Check for unreachable agents
        const unreachableAgents = Array.from(this.agents.values())
            .filter(agent => agent.status === 'unreachable');
        
        if (unreachableAgents.length > 0) {
            recommendations.push(`❌ Fix connectivity for agents: ${unreachableAgents.map(a => a.id).join(', ')}`);
            recommendations.push('   - Check network connectivity');
            recommendations.push('   - Verify agent endpoints and ports');
            recommendations.push('   - Check firewall settings');
        }

        // Check for communication imbalances
        const totalSent = Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.messagesSent, 0);
        const totalReceived = Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.messagesReceived, 0);
        
        if (Math.abs(totalSent - totalReceived) > totalSent * 0.1) {
            recommendations.push('⚠️ Message delivery imbalance detected');
            recommendations.push('   - Check for message queue issues');
            recommendations.push('   - Verify acknowledgment mechanisms');
        }

        // Check for errors
        const agentsWithErrors = Array.from(this.agents.values()).filter(agent => agent.errors.length > 0);
        if (agentsWithErrors.length > 0) {
            recommendations.push('⚠️ Some agents have communication errors');
            recommendations.push('   - Review agent error logs');
            recommendations.push('   - Check system resources');
            recommendations.push('   - Consider restarting problematic agents');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ No issues detected - communication appears healthy');
        }

        return recommendations;
    }
}

// Usage example
const debugger = new AgentCommunicationDebugger();

const testTeamConfig = {
    teamId: 'test_team',
    agents: [
        { agent_id: 'agent_1', role: 'data_analyst' },
        { agent_id: 'agent_2', role: 'report_writer' },
        { agent_id: 'agent_3', role: 'reviewer' }
    ]
};

// Run full communication test
debugger.runFullCommunicationTest(testTeamConfig)
    .then(results => {
        console.log('\nTest completed');
        debugger.generateTroubleshootingReport();
    })
    .catch(error => {
        console.error('Test failed:', error);
    });


6. Performance Troubleshooting
6.1 Slow Response Times
6.1.1 Response Time Analysis
Response Time Profiler:
#!/bin/bash
# response_time_profiler.sh

API_TOKEN="$1"
BASE_URL="${2:-http://localhost:3000}"

if [ -z "$API_TOKEN" ]; then
    echo "Usage: $0 <api_token> [base_url]"
    exit 1
fi

echo "=== Response Time Performance Analysis ==="
echo "Base URL: $BASE_URL"
echo "Testing started: $(date)"
echo

# Test endpoints with timing
test_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    
    echo -n "Testing $method $endpoint: "
    
    if [ "$method" = "GET" ]; then
        RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null -H "Authorization: Bearer $API_TOKEN" "$BASE_URL$endpoint")
    else
        RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null -X "$method" -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc -l)
    printf "%.0f ms" $RESPONSE_TIME_MS
    
    if (( $(echo "$RESPONSE_TIME > 1.0" | bc -l) )); then
        echo " ⚠️ SLOW"
    elif (( $(echo "$RESPONSE_TIME > 0.5" | bc -l) )); then
        echo " 🔶 MODERATE"
    else
        echo " ✅ FAST"
    fi
}

# Health check endpoint
test_endpoint "/health"

# Detailed health check
test_endpoint "/health?detailed=true"

# Profile operations
test_endpoint "/profiles/user/test_user" "GET"

# If test profile doesn't exist, create it first
curl -s -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" -X POST "$BASE_URL/profiles/user" -d '{"user_id":"test_user","canonical_name":"Test User"}' > /dev/null 2>&1

test_endpoint "/profiles/user/test_user?includeState=true&includeLogs=true"

# Profile update
test_endpoint "/profiles/user/test_user" "PATCH" '{"canonical_name":"Updated Test User"}'

# Load testing with multiple concurrent requests
echo
echo "Load Testing (10 concurrent requests):"
echo -n "Average response time: "

TOTAL_TIME=0
for i in {1..10}; do
    RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/health" &)
    PIDS="$PIDS $!"
done

# Wait for all requests to complete
wait

# Calculate average (simplified)
AVERAGE_TIME=$(curl -w "%{time_total}" -s -o /dev/null -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/health")
AVERAGE_TIME_MS=$(echo "$AVERAGE_TIME * 1000" | bc -l)
printf "%.0f ms\n" $AVERAGE_TIME_MS

# Database performance test
echo
echo "Database Performance Test:"
if [ -f "vault.db" ]; then
    echo -n "Database query time: "
    DB_START=$(date +%s%3N)
    sqlite3 vault.db "SELECT COUNT(*) FROM profiles;" > /dev/null
    DB_END=$(date +%s%3N)
    DB_TIME=$((DB_END - DB_START))
    echo "${DB_TIME}ms"
    
    if [ $DB_TIME -gt 100 ]; then
        echo "⚠️ Database queries are slow - consider optimization"
    else
        echo "✅ Database performance is good"
    fi
else
    echo "❌ Database file not found"
fi

echo
echo "=== Performance Analysis Complete ==="
echo

# Performance recommendations
echo "Performance Recommendations:"

# Check system resources
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 80.0" | bc -l) )); then
    echo "⚠️ High memory usage (${MEMORY_USAGE}%) - consider adding more RAM"
fi

CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
if (( $(echo "$CPU_USAGE > 80.0" | bc -l) )); then
    echo "⚠️ High CPU usage (${CPU_USAGE}%) - check for resource-intensive processes"
fi

# Check for long-running processes
LONG_PROCESSES=$(ps aux | awk '$10 ~ /[0-9]+:[0-9][0-9]/ && $11 ~ /node/ {print $2}' | wc -l)
if [ $LONG_PROCESSES -gt 0 ]; then
    echo "⚠️ Found $LONG_PROCESSES long-running Node processes - investigate for memory leaks"
fi

echo "✅ Consider implementing caching for frequently accessed data"
echo "✅ Monitor database query performance regularly"
echo "✅ Use connection pooling for database access"

6.1.2 Database Performance Optimization
Database Optimization Script:
#!/bin/bash
# database_optimizer.sh

DB_FILE="vault.db"

echo "=== Database Performance Optimization ==="

if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database file not found: $DB_FILE"
    exit 1
fi

# Backup database first
echo "1. Creating backup..."
BACKUP_FILE="${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$DB_FILE" "$BACKUP_FILE"
echo "   Backup created: $BACKUP_FILE"

# Database analysis
echo
echo "2. Database Analysis:"
DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
echo "   Database size: $DB_SIZE"

# Table analysis
echo "   Table information:"
sqlite3 "$DB_FILE" "SELECT name, COUNT(*) as count FROM sqlite_master WHERE type='table' GROUP BY name;" | while IFS='|' read -r table_name count; do
    if [ "$table_name" != "sqlite_sequence" ]; then
        ROW_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM $table_name;" 2>/dev/null || echo "0")
        echo "     $table_name: $ROW_COUNT rows"
    fi
done

# Index analysis
echo
echo "3. Index Analysis:"
INDEX_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo "0")
echo "   Total indexes: $INDEX_COUNT"

sqlite3 "$DB_FILE" "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';" | while IFS='|' read -r index_name table_name; do
    echo "     $index_name on $table_name"
done

# Performance optimization
echo
echo "4. Performance Optimization:"

# Analyze and optimize tables
sqlite3 "$DB_FILE" << EOF
-- Analyze database for query optimization
ANALYZE;

-- Update database statistics
PRAGMA optimize;

-- Vacuum database to reclaim space and improve performance  
VACUUM;

-- Update database metadata
PRAGMA integrity_check;
EOF

OPTIMIZE_RESULT=$?
if [ $OPTIMIZE_RESULT -eq 0 ]; then
    echo "   ✅ Database optimization completed"
else
    echo "   ❌ Database optimization failed"
fi

# Check for missing indexes
echo
echo "5. Index Recommendations:"

# Check if common query indexes exist
PROFILE_ID_INDEX=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_profiles_id';" 2>/dev/null || echo "0")
if [ "$PROFILE_ID_INDEX" -eq 0 ]; then
    echo "   ⚠️ Missing index on profile_id - creating..."
    sqlite3 "$DB_FILE" "CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(profile_id);"
    echo "     ✅ Created idx_profiles_id"
fi

TYPE_INDEX=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_profiles_type';" 2>/dev/null || echo "0")
if [ "$TYPE_INDEX" -eq 0 ]; then
    echo "   ⚠️ Missing index on type - creating..."
    sqlite3 "$DB_FILE" "CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(type);"
    echo "     ✅ Created idx_profiles_type"
fi

CREATED_AT_INDEX=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_profiles_created';" 2>/dev/null || echo "0")
if [ "$CREATED_AT_INDEX" -eq 0 ]; then
    echo "   ⚠️ Missing index on created_at - creating..."
    sqlite3 "$DB_FILE" "CREATE INDEX IF NOT EXISTS idx_profiles_created ON profiles(created_at);"
    echo "     ✅ Created idx_profiles_created"
fi

# Query performance test
echo
echo "6. Query Performance Test:"

# Test common queries
echo "   Profile by ID query:"
QUERY_START=$(date +%s%3N)
sqlite3 "$DB_FILE" "SELECT profile_id, type FROM profiles WHERE profile_id = 'test_user';" > /dev/null 2>&1
QUERY_END=$(date +%s%3N)
QUERY_TIME=$((QUERY_END - QUERY_START))
echo "     Time: ${QUERY_TIME}ms"

if [ $QUERY_TIME -gt 50 ]; then
    echo "     ⚠️ Slow query - consider additional indexing"
else
    echo "     ✅ Query performance is good"
fi

# Test count query
echo "   Profile count query:"
COUNT_START=$(date +%s%3N)
TOTAL_PROFILES=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM profiles;")
COUNT_END=$(date +%s%3N)
COUNT_TIME=$((COUNT_END - COUNT_START))
echo "     Time: ${COUNT_TIME}ms (${TOTAL_PROFILES} profiles)"

# Database size after optimization
NEW_DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
echo
echo "7. Optimization Results:"
echo "   Size before: $DB_SIZE"
echo "   Size after: $NEW_DB_SIZE"

# PRAGMA settings for performance
echo
echo "8. Applying Performance Settings:"
sqlite3 "$DB_FILE" << EOF
-- Set journal mode for better performance
PRAGMA journal_mode=WAL;

-- Set synchronous mode for balance of safety and performance
PRAGMA synchronous=NORMAL;

-- Set cache size (in pages, -ve means KB)
PRAGMA cache_size=-64000;

-- Set temp store to memory
PRAGMA temp_store=MEMORY;

-- Set mmap size for memory-mapped I/O
PRAGMA mmap_size=268435456;

-- Show current settings
.echo on
PRAGMA journal_mode;
PRAGMA synchronous; 
PRAGMA cache_size;
PRAGMA temp_store;
PRAGMA mmap_size;
.echo off
EOF

echo
echo "=== Database Optimization Complete ==="
echo "Backup available at: $BACKUP_FILE"


7. Database Issues
7.1 Database Corruption
7.1.1 Database Integrity Check
Database Integrity Checker:
#!/bin/bash
# database_integrity_checker.sh

DB_FILE="${1:-vault.db}"

echo "=== Database Integrity Checker ==="
echo "Database: $DB_FILE"
echo "Timestamp: $(date)"
echo

if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database file not found: $DB_FILE"
    echo
    echo "Possible causes:"
    echo "1. Database hasn't been created yet"
    echo "2. Incorrect file path"
    echo "3. Permission issues"
    echo
    echo "Solutions:"
    echo "1. Start the application to create the database"
    echo "2. Check the DB_PATH environment variable"
    echo "3. Verify file permissions"
    exit 1
fi

# Basic file checks
echo "1. Basic File Analysis:"
DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
echo "   File size: $DB_SIZE"
echo "   File permissions: $(ls -l "$DB_FILE" | awk '{print $1}')"
echo "   File owner: $(ls -l "$DB_FILE" | awk '{print $3":"$4}')"

# Check if file is a valid SQLite database
echo
echo "2. SQLite Format Validation:"
if file "$DB_FILE" | grep -q "SQLite"; then
    echo "   ✅ Valid SQLite database format"
    
    # Get SQLite version info
    SQLITE_VERSION=$(sqlite3 --version | cut -d' ' -f1)
    echo "   SQLite version: $SQLITE_VERSION"
else
    echo "   ❌ File is not a valid SQLite database"
    echo "   File type: $(file "$DB_FILE")"
    exit 1
fi

# Comprehensive integrity check
echo
echo "3. Database Integrity Check:"
INTEGRITY_RESULT=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>&1)

if [ "$INTEGRITY_RESULT" = "ok" ]; then
    echo "   ✅ Database integrity: OK"
else
    echo "   ❌ Database integrity issues found:"
    echo "$INTEGRITY_RESULT" | sed 's/^/     /'
    
    echo
    echo "   🔧 Attempting repair..."
    
    # Try to repair using dump and restore
    BACKUP_DB="${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    REPAIR_DB="${DB_FILE}.repaired.$(date +%Y%m%d_%H%M%S)"
    
    # Create backup
    cp "$DB_FILE" "$BACKUP_DB"
    echo "     Backup created: $BACKUP_DB"
    
    # Attempt repair by dumping and restoring
    if sqlite3 "$DB_FILE" ".dump" | sqlite3 "$REPAIR_DB" 2>/dev/null; then
        # Verify repaired database
        REPAIR_INTEGRITY=$(sqlite3 "$REPAIR_DB" "PRAGMA integrity_check;")
        if [ "$REPAIR_INTEGRITY" = "ok" ]; then
            echo "     ✅ Database repaired successfully"
            echo "     Repaired database: $REPAIR_DB"
            echo "     Replace original with: mv '$REPAIR_DB' '$DB_FILE'"
        else
            echo "     ❌ Repair attempt failed"
            rm -f "$REPAIR_DB"
        fi
    else
        echo "     ❌ Cannot dump database for repair"
    fi
fi

# Schema validation
echo
echo "4. Schema Validation:"
EXPECTED_TABLES=("profiles" "logs" "state")

for table in "${EXPECTED_TABLES[@]}"; do
    if sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "$table"; then
        echo "   ✅ Table '$table' exists"
        
        # Check table structure
        COLUMN_COUNT=$(sqlite3 "$DB_FILE" "PRAGMA table_info($table);" | wc -l)
        echo "     Columns: $COLUMN_COUNT"
        
        # Check for data
        ROW_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "ERROR")
        if [ "$ROW_COUNT" = "ERROR" ]; then
            echo "     ❌ Cannot query table - possible corruption"
        else
            echo "     Rows: $ROW_COUNT"
        fi
    else
        echo "   ⚠️ Table '$table' missing"
    fi
done

# Foreign key check
echo
echo "5. Foreign Key Validation:"
FK_VIOLATIONS=$(sqlite3 "$DB_FILE" "PRAGMA foreign_key_check;" 2>&1)

if [ -z "$FK_VIOLATIONS" ]; then
    echo "   ✅ No foreign key violations"
else
    echo "   ❌ Foreign key violations found:"
    echo "$FK_VIOLATIONS" | sed 's/^/     /'
fi

# Performance statistics
echo
echo "6. Database Statistics:"
sqlite3 "$DB_FILE" << 'EOF'
.header on
.mode column
SELECT 
    name as "Table Name",
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as "Indexes",
    CASE 
        WHEN name NOT LIKE 'sqlite_%' THEN 
            (SELECT COUNT(*) FROM eval(name))
        ELSE 'N/A'
    END as "Rows"
FROM sqlite_master m 
WHERE type='table' 
ORDER BY name;
EOF

# Journal and WAL file checks
echo
echo "7. Associated Files Check:"
if [ -f "${DB_FILE}-journal" ]; then
    JOURNAL_SIZE=$(du -h "${DB_FILE}-journal" | cut -f1)
    echo "   Journal file: ${JOURNAL_SIZE} (${DB_FILE}-journal)"
    
    if [ "$JOURNAL_SIZE" != "0B" ] && [ "$JOURNAL_SIZE" != "0" ]; then
        echo "     ⚠️ Non-empty journal file indicates incomplete transaction"
    fi
fi

if [ -f "${DB_FILE}-wal" ]; then
    WAL_SIZE=$(du -h "${DB_FILE}-wal" | cut -f1)
    echo "   WAL file: ${WAL_SIZE} (${DB_FILE}-wal)"
fi

if [ -f "${DB_FILE}-shm" ]; then
    echo "   Shared memory file: ${DB_FILE}-shm"
fi

# Quick backup verification
echo
echo "8. Backup Test:"
BACKUP_TEST_FILE="/tmp/db_backup_test_$(date +%s).db"

if sqlite3 "$DB_FILE" ".backup '$BACKUP_TEST_FILE'" 2>/dev/null; then
    echo "


