export type Header = {}

class API {
    baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    async get(path: string, header?: Header) {

        const response = await fetch(`${this.baseURL}${path}`, {
            method: "GET",
            headers: header != null ? header : {
                "Content-Type": "application/json",
            },
        });
        return response.json();
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

    async put(path: string, data: any, header?: Header) {

        const response = await fetch(`${this.baseURL}${path}`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: header != null ? header : {
                "Content-Type": "application/json",
            }
        });
        return response.json();
    }

    async delete(path: string, header?: Header) {

        const response = await fetch(`${this.baseURL}${path}`, {
            method: "DELETE",
            headers: header != null ? header : {
                "Content-Type": "application/json",
            }
        });
        return response.json();
    }
    
}

export default API;