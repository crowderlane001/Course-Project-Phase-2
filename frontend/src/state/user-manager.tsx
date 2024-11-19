import User from "@/models/user-model";

class UserManager {
    user: User | null = null;
    listeners: Function[] = [];

    subscribe(listener: Function) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        }
    }

    notify(): void {
        this.listeners.forEach((listener) => listener(this.user));
    }

    setUser = (user: User | null ): void => {
        this.user = user;
        this.notify();
    }

    getUser = (): User | null => {
        return this.user;
    }

}

export const userManager = new UserManager();