class SessionLogger {
    activateLogs: boolean = true;

    warn(str: string): void {
        if(this.activateLogs){
            console.warn(str);
        }
    }

    activate(activate: boolean) {
        this.activateLogs = activate;
    }
}

const sessionLogger = new SessionLogger();

export default sessionLogger;
