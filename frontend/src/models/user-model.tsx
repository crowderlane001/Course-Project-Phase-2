interface UserProps {
    token: string;
    username: string;
    isAdmin: boolean;
}

class User {
    token: string;
    username: string;
    isAdmin: boolean = false;
    constructor({token, username, isAdmin}: UserProps) {
        this.token = token;
        this.username = username;
        this.isAdmin = isAdmin;
    }
}

export default User