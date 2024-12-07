export type Header = {}

class API {
    baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    async get(path: string, header?: Header, retries = 3) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "GET",
                headers: header != null ? header : {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (retries > 0) {
                console.warn(`Retrying... (${3 - retries + 1})`);
                return this.get(path, header, retries - 1);
            }
            console.error("Error fetching data: ", error);
            throw error;
        }
    }

    async post(path: string, data: any, header?: Header, retries = 3) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "POST",
                headers: header != null ? header : {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (retries > 0) {
                console.warn(`Retrying... (${3 - retries + 1})`);
                return this.post(path, data, header, retries - 1);
            }
            console.error("Error fetching data: ", error);
            throw error;
        }
    }

    async put(path: string, data: any, retries = 3) {
        try {
            const response = await fetch(`${this.baseURL}${path}`, {
                method: "PUT",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json",
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (retries > 0) {
                console.warn(`Retrying... (${3 - retries + 1})`);
                return this.put(path, data, retries - 1);
            }
            console.error("Error fetching data: ", error);
            throw error;
        }
    }
}

export default API;