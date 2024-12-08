class Package {
    id: string;
    name: string;
    version: string;
    constructor(id: string, name: string, version: string) {
        this.id = id;
        this.name = name;
        this.version = version;
    }
}

export default Package