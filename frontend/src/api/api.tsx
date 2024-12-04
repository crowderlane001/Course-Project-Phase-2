export type Header = {}

class API {
    baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    async get(path: string) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            return response.json();
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    }

    async post(path: string, data: any, header?: Header) {
        const response = await fetch(`${this.baseURL}${path}`, {
            method: "POST",
            headers: header != null ? header : {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }
}

export default API;