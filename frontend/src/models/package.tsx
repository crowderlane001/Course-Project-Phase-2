class Package {
    id: string;
    name: string;
    description: string;
    score: string;
    constructor(id: string, name: string, description: string, score: string) { 
        this.id = id;
        this.name = name;
        this.description = description;
        this.score = score;
    }
}

export default Package