export class AccessDefinition {
    constructor(
        public cidr: string,
        public description: string,
    ) {
        // Support both ipAddress and cidr for backwards compatibility
        this.ipAddress = cidr;
    }
    
    // Alias for backwards compatibility
    public ipAddress: string;
}
