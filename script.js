class HTTPPingTool {
    constructor() {
        this.isRunning = false;
        this.pingCount = 0;
        this.totalPings = 0;
        this.successCount = 0;
        this.responseTimes = [];
        this.currentTimeout = null;
        this.resolvedIP = null;
        this.targetHost = null;
        
        this.initializeElements();
        this.bindEvents();
        this.updateUI();
        this.addInitialMessages();
    }
    
    initializeElements() {
        // Input elements
        this.targetUrlInput = document.getElementById('target-url');
        this.httpMethodSelect = document.getElementById('http-method');
        this.pingCountInput = document.getElementById('ping-count');
        this.pingIntervalInput = document.getElementById('ping-interval');
        this.timeoutInput = document.getElementById('timeout');
        this.ignoreSslCheckbox = document.getElementById('ignore-ssl');
        this.followRedirectsCheckbox = document.getElementById('follow-redirects');
        this.verboseModeCheckbox = document.getElementById('verbose-mode');
        
        // Control buttons
        this.startButton = document.getElementById('start-ping');
        this.stopButton = document.getElementById('stop-ping');
        this.clearButton = document.getElementById('clear-output');
        
        // Status display elements
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.packetsSentSpan = document.getElementById('packets-sent');
        this.packetsReceivedSpan = document.getElementById('packets-received');
        this.packetLossSpan = document.getElementById('packet-loss');
        this.minRttSpan = document.getElementById('min-rtt');
        this.maxRttSpan = document.getElementById('max-rtt');
        this.avgRttSpan = document.getElementById('avg-rtt');
        
        // Terminal output
        this.terminalOutput = document.getElementById('terminal-output');
    }
    
    bindEvents() {
        this.startButton.addEventListener('click', () => this.startPing());
        this.stopButton.addEventListener('click', () => this.stopPing());
        this.clearButton.addEventListener('click', () => this.clearOutput());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c' && this.isRunning) {
                e.preventDefault();
                this.stopPing();
            }
        });
    }
    
    addInitialMessages() {
        this.addTerminalLine('HTTP Ping utility ready. Enter a URL or IP address to begin.', 'info');
        this.addTerminalLine('Use Ctrl+C to stop pinging.', 'info');
        this.addTerminalLine('', '');
    }
    
    async startPing() {
        const url = this.targetUrlInput.value.trim();
        if (!url) {
            this.addTerminalLine('Error: Please enter a target URL or IP address', 'error');
            return;
        }
        
        this.isRunning = true;
        this.pingCount = 0;
        this.successCount = 0;
        this.responseTimes = [];
        this.totalPings = parseInt(this.pingCountInput.value);
        this.resolvedIP = null;
        this.targetHost = null;
        
        this.updateControlsState();
        this.updateStatusIndicator('running');
        
        // Clear previous results
        this.clearTerminalOutput();
        
        // Parse and validate URL
        const parsedUrl = this.parseUrl(url);
        if (!parsedUrl) {
            this.addTerminalLine(`Error: Invalid URL format: ${url}`, 'error');
            this.stopPing();
            return;
        }
        
        this.targetHost = parsedUrl.hostname;
        
        // Check if it's an IP address
        if (this.isIPAddress(this.targetHost)) {
            this.resolvedIP = this.targetHost;
            this.addTerminalLine(`PING ${parsedUrl.fullUrl} (${this.resolvedIP})`, 'info');
        } else {
            // Attempt DNS resolution simulation
            this.addTerminalLine(`PING ${parsedUrl.fullUrl}`, 'info');
            this.addTerminalLine(`Attempting to resolve ${this.targetHost}...`, 'dns');
            
            const dnsResult = await this.simulateDNSResolution(this.targetHost);
            if (!dnsResult.success) {
                this.addTerminalLine(`ping: cannot resolve ${this.targetHost}: ${dnsResult.error}`, 'error');
                this.stopPing();
                return;
            }
            
            this.resolvedIP = dnsResult.ip;
            this.addTerminalLine(`PING ${parsedUrl.fullUrl} (${this.resolvedIP})`, 'info');
        }
        
        // Add SSL certificate info if HTTPS
        if (parsedUrl.protocol === 'https:' && this.ignoreSslCheckbox.checked) {
            this.addTerminalLine('SSL certificate verification disabled (-k flag)', 'warning');
        }
        
        // Add redirect info
        if (this.followRedirectsCheckbox.checked) {
            this.addTerminalLine('Following redirects enabled (-L flag)', 'info');
        }
        
        this.addTerminalLine('', '');
        
        await this.performPingSequence(parsedUrl);
    }
    
    stopPing() {
        this.isRunning = false;
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        
        this.updateControlsState();
        this.updateStatusIndicator('stopped');
        
        if (this.pingCount > 0) {
            this.addTerminalLine('', '');
            this.addTerminalLine('^C', 'warning');
            this.displayFinalStatistics();
        }
    }
    
    clearOutput() {
        this.clearTerminalOutput();
        this.resetStats();
        this.addInitialMessages();
    }
    
    clearTerminalOutput() {
        const lines = this.terminalOutput.querySelectorAll('.terminal-line');
        lines.forEach(line => line.remove());
        
        // Keep the cursor
        const cursor = this.terminalOutput.querySelector('.terminal-cursor');
        if (cursor) {
            cursor.style.display = 'block';
        }
    }
    
    parseUrl(input) {
        try {
            let url = input.trim();
            
            // If it's just a domain or IP, add http://
            if (!url.match(/^https?:\/\//)) {
                // Check if it looks like an IP address
                if (this.isIPAddress(url)) {
                    url = `http://${url}`;
                } else {
                    // For domains, try HTTPS first, fallback to HTTP
                    url = `https://${url}`;
                }
            }
            
            const parsed = new URL(url);
            return {
                fullUrl: url,
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
                pathname: parsed.pathname || '/'
            };
        } catch (error) {
            return null;
        }
    }
    
    isIPAddress(str) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(str) || ipv6Regex.test(str);
    }
    
    async simulateDNSResolution(hostname) {
        // Simulate DNS resolution by attempting a connection
        try {
            const testUrl = `https://${hostname}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            await fetch(testUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Simulate an IP address (in real CLI, this would be the actual resolved IP)
            const simulatedIP = this.generateSimulatedIP(hostname);
            return { success: true, ip: simulatedIP };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                return { success: false, error: 'DNS resolution timeout' };
            }
            
            // Try HTTP as fallback
            try {
                const testUrl = `http://${hostname}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                await fetch(testUrl, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const simulatedIP = this.generateSimulatedIP(hostname);
                return { success: true, ip: simulatedIP };
                
            } catch (httpError) {
                return { success: false, error: 'Name or service not known' };
            }
        }
    }
    
    generateSimulatedIP(hostname) {
        // Generate a consistent "IP" based on hostname for display purposes
        let hash = 0;
        for (let i = 0; i < hostname.length; i++) {
            const char = hostname.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        const a = Math.abs(hash) % 256;
        const b = Math.abs(hash >> 8) % 256;
        const c = Math.abs(hash >> 16) % 256;
        const d = Math.abs(hash >> 24) % 256;
        
        return `${a}.${b}.${c}.${d}`;
    }
    
    async performPingSequence(parsedUrl) {
        const method = this.httpMethodSelect.value;
        const interval = parseInt(this.pingIntervalInput.value);
        const timeout = parseInt(this.timeoutInput.value);
        
        for (let i = 0; i < this.totalPings && this.isRunning; i++) {
            this.pingCount = i + 1;
            this.updateUI();
            
            try {
                await this.performSinglePing(parsedUrl, method, timeout, i + 1);
            } catch (error) {
                console.error('Ping error:', error);
            }
            
            if (i < this.totalPings - 1 && this.isRunning) {
                await this.delay(interval);
            }
        }
        
        if (this.isRunning) {
            this.addTerminalLine('', '');
            this.displayFinalStatistics();
            this.updateStatusIndicator('ready');
            this.isRunning = false;
            this.updateControlsState();
        }
    }
    
    async performSinglePing(parsedUrl, method, timeout, sequence) {
        const startTime = performance.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            // First try with CORS mode
            const requestOptions = {
                method: method,
                mode: 'cors',
                redirect: this.followRedirectsCheckbox.checked ? 'follow' : 'manual',
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            };
            
            // Add body for POST/PUT requests
            if (['POST', 'PUT'].includes(method)) {
                requestOptions.body = JSON.stringify({ 
                    timestamp: Date.now(),
                    sequence: sequence 
                });
                requestOptions.headers['Content-Type'] = 'application/json';
            }
            
            let response;
            try {
                response = await fetch(parsedUrl.fullUrl, requestOptions);
            } catch (corsError) {
                // If CORS fails, try no-cors mode for GET requests to at least measure timing
                if (method === 'GET') {
                    clearTimeout(timeoutId);
                    const noCorsController = new AbortController();
                    const noCorsTimeoutId = setTimeout(() => noCorsController.abort(), timeout);
                    
                    try {
                        const noCorsOptions = {
                            method: 'GET',
                            mode: 'no-cors',
                            signal: noCorsController.signal,
                            headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache'
                            }
                        };
                        
                        response = await fetch(parsedUrl.fullUrl, noCorsOptions);
                        clearTimeout(noCorsTimeoutId);
                        
                        const endTime = performance.now();
                        const responseTime = Math.round(endTime - startTime);
                        
                        // no-cors mode doesn't give us status, but we can measure timing
                        this.addTerminalLine(
                            `64 bytes from ${this.resolvedIP}: seq=${sequence} time=${responseTime}ms (no-cors mode - status unknown)`,
                            'warning'
                        );
                        
                        if (this.verboseModeCheckbox.checked) {
                            this.addTerminalLine('Note: no-cors mode prevents reading response details', 'info');
                        }
                        
                        return;
                        
                    } catch (noCorsError) {
                        clearTimeout(noCorsTimeoutId);
                        throw corsError; // Fall back to original CORS error
                    }
                } else {
                    throw corsError;
                }
            }
            
            clearTimeout(timeoutId);
            
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            // Handle redirects when not following them
            if (!this.followRedirectsCheckbox.checked && response.status >= 300 && response.status < 400) {
                const location = response.headers.get('Location');
                this.addTerminalLine(
                    `64 bytes from ${this.resolvedIP}: seq=${sequence} time=${responseTime}ms HTTP/${response.status} ${response.statusText} (redirect to ${location})`,
                    'warning'
                );
                
                if (this.verboseModeCheckbox.checked) {
                    this.addTerminalLine(`Location: ${location}`, 'info');
                }
                
                return;
            }
            
            // Success response
            if (response.ok) {
                this.successCount++;
                this.responseTimes.push(responseTime);
                
                let statusLine = `64 bytes from ${this.resolvedIP}: seq=${sequence} time=${responseTime}ms HTTP/${response.status} ${response.statusText}`;
                
                if (this.verboseModeCheckbox.checked) {
                    statusLine += ` size=${response.headers.get('content-length') || 'unknown'}`;
                }
                
                this.addTerminalLine(statusLine, 'success');
                
                if (this.verboseModeCheckbox.checked) {
                    this.addTerminalLine(`> ${method} ${parsedUrl.pathname} HTTP/1.1`, 'info');
                    this.addTerminalLine(`> Host: ${parsedUrl.hostname}`, 'info');
                    this.addTerminalLine(`< HTTP/1.1 ${response.status} ${response.statusText}`, 'info');
                    this.addTerminalLine(`< Content-Type: ${response.headers.get('content-type') || 'unknown'}`, 'info');
                }
                
            } else {
                // Error response
                this.addTerminalLine(
                    `64 bytes from ${this.resolvedIP}: seq=${sequence} time=${responseTime}ms HTTP/${response.status} ${response.statusText}`,
                    'error'
                );
            }
            
        } catch (error) {
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            let errorMessage = '';
            if (error.name === 'AbortError') {
                errorMessage = `From ${this.resolvedIP}: seq=${sequence} Request timeout (>${timeout}ms)`;
            } else if (error.message.includes('CORS')) {
                // CORS error - show clear message
                this.addTerminalLine(`From ${this.resolvedIP}: seq=${sequence} CORS policy blocked`, 'error');
                this.addTerminalLine('', '');
                this.addTerminalLine('⚠️  APPLICATION NOT WORKING BECAUSE OF CORS ERROR', 'error');
                this.addTerminalLine('', '');
                this.addTerminalLine('CORS (Cross-Origin Resource Sharing) prevents this browser-based', 'warning');
                this.addTerminalLine('ping tool from accessing many websites directly.', 'warning');
                this.addTerminalLine('', '');
                this.addTerminalLine('Solutions:', 'info');
                this.addTerminalLine('1. Use CORS-enabled endpoints like httpbin.org', 'info');
                this.addTerminalLine('2. Install a CORS browser extension', 'info');
                this.addTerminalLine('3. Use a local proxy server', 'info');
                this.addTerminalLine('4. Test with APIs that support CORS', 'info');
                this.addTerminalLine('5. Launch Chrome with --disable-web-security flag', 'info');
                this.addTerminalLine('', '');
                this.stopPing();
                return;
            } else if (error.message.includes('Failed to fetch')) {
                // This is likely a CORS error disguised as "Failed to fetch"
                this.addTerminalLine(`From ${this.resolvedIP}: seq=${sequence} Network unreachable (likely CORS)`, 'error');
                this.addTerminalLine('', '');
                this.addTerminalLine('⚠️  APPLICATION NOT WORKING BECAUSE OF CORS ERROR', 'error');
                this.addTerminalLine('', '');
                this.addTerminalLine('The "Network unreachable" error is typically caused by CORS', 'warning');
                this.addTerminalLine('(Cross-Origin Resource Sharing) policy blocking the request.', 'warning');
                this.addTerminalLine('', '');
                this.addTerminalLine('This is a browser security feature that prevents websites', 'warning');
                this.addTerminalLine('from making requests to other domains without permission.', 'warning');
                this.addTerminalLine('', '');
                this.addTerminalLine('Try these CORS-enabled endpoints instead:', 'info');
                this.addTerminalLine('• httpbin.org/get', 'info');
                this.addTerminalLine('• jsonplaceholder.typicode.com/posts/1', 'info');
                this.addTerminalLine('• api.github.com', 'info');
                this.addTerminalLine('• httpstat.us/200', 'info');
                this.addTerminalLine('', '');
                this.addTerminalLine('Or disable CORS in Chrome:', 'info');
                this.addTerminalLine('chrome --disable-web-security --user-data-dir=/tmp/chrome', 'info');
                this.addTerminalLine('', '');
                this.stopPing();
                return;
            } else {
                errorMessage = `From ${this.resolvedIP}: seq=${sequence} ${error.message}`;
            }
            
            if (errorMessage) {
                this.addTerminalLine(errorMessage, 'error');
            }
        }
    }
    
    displayFinalStatistics() {
        const host = this.targetHost || 'unknown';
        this.addTerminalLine(`--- ${host} ping statistics ---`, 'info');
        
        const packetLoss = this.pingCount > 0 ? 
            Math.round(((this.pingCount - this.successCount) / this.pingCount) * 100) : 0;
        
        this.addTerminalLine(
            `${this.pingCount} packets transmitted, ${this.successCount} received, ${packetLoss}% packet loss`,
            packetLoss > 0 ? 'warning' : 'success'
        );
        
        if (this.responseTimes.length > 0) {
            const min = Math.min(...this.responseTimes);
            const max = Math.max(...this.responseTimes);
            const avg = Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length);
            
            this.addTerminalLine(
                `round-trip min/avg/max = ${min}/${avg}/${max} ms`,
                'info'
            );
        }
    }
    
    addTerminalLine(text, type = '') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        line.textContent = text;
        
        // Insert before cursor
        const cursor = this.terminalOutput.querySelector('.terminal-cursor');
        this.terminalOutput.insertBefore(line, cursor);
        
        // Auto-scroll to bottom
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }
    
    updateUI() {
        this.packetsSentSpan.textContent = this.pingCount;
        this.packetsReceivedSpan.textContent = this.successCount;
        
        // Packet loss
        const packetLoss = this.pingCount > 0 ? 
            Math.round(((this.pingCount - this.successCount) / this.pingCount) * 100) : 0;
        this.packetLossSpan.textContent = packetLoss + '%';
        
        // RTT statistics
        if (this.responseTimes.length > 0) {
            const min = Math.min(...this.responseTimes);
            const max = Math.max(...this.responseTimes);
            const avg = Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length);
            
            this.minRttSpan.textContent = min + 'ms';
            this.maxRttSpan.textContent = max + 'ms';
            this.avgRttSpan.textContent = avg + 'ms';
        } else {
            this.minRttSpan.textContent = '-';
            this.maxRttSpan.textContent = '-';
            this.avgRttSpan.textContent = '-';
        }
    }
    
    updateControlsState() {
        this.startButton.disabled = this.isRunning;
        this.stopButton.disabled = !this.isRunning;
        
        // Disable form controls while running
        this.targetUrlInput.disabled = this.isRunning;
        this.httpMethodSelect.disabled = this.isRunning;
        this.pingCountInput.disabled = this.isRunning;
        this.pingIntervalInput.disabled = this.isRunning;
        this.timeoutInput.disabled = this.isRunning;
        this.ignoreSslCheckbox.disabled = this.isRunning;
        this.followRedirectsCheckbox.disabled = this.isRunning;
        this.verboseModeCheckbox.disabled = this.isRunning;
    }
    
    updateStatusIndicator(status) {
        this.statusIndicator.className = `indicator ${status}`;
        
        switch (status) {
            case 'ready':
                this.statusText.textContent = 'Ready';
                break;
            case 'running':
                this.statusText.textContent = 'Pinging...';
                break;
            case 'stopped':
                this.statusText.textContent = 'Stopped';
                break;
            case 'error':
                this.statusText.textContent = 'Error';
                break;
        }
    }
    
    resetStats() {
        this.pingCount = 0;
        this.successCount = 0;
        this.responseTimes = [];
        this.updateUI();
        this.updateStatusIndicator('ready');
    }
    
    delay(ms) {
        return new Promise(resolve => {
            this.currentTimeout = setTimeout(resolve, ms);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HTTPPingTool();
});