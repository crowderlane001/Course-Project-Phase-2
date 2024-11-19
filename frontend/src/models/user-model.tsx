interface UserProps {
    token: string;
    username: string;
}

class User {
    token: string;
    username: string;
    constructor({token, username}: UserProps) {
        this.token = token;
        this.username = username;
    }
}

export default User