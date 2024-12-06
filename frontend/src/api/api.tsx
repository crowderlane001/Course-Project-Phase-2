export type Header = {}

class API {
    baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    async get(path: string, header?: Header) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "GET",
                headers: header != null ? header : {
                    "Content-Type": "application/json",
                },
            });
            return response.json();
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    }

    async post(path: string, data: any, header?: Header) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "POST",
                headers: header != null ? header : {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            return response.json();
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    }

    async put(path: string, data: any) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "PUT",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json",
                }
            });
            return response.json();
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    }
}

export default API;