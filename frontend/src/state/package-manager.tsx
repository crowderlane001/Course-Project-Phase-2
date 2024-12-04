import Package from '@/models/package';

class PackageManager {
    packages: Map<string, Package>;
    listeners: Function[];
    constructor() {
        this.packages = new Map<string, Package>();
        this.listeners = [];
    }

    subscribe(listener: Function) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        }
    }

    notify() {
        this.listeners.forEach((listener) => listener(this.packages));
    }

    setPackages(packages: Package[]) {
        this.packages = new Map<string, Package>();
        packages.forEach((p) => this.packages.set(p.id, p));
        this.notify();
    }

    getPackages() {
        return this.packages;
    }

    getPackage(id: string) {
        return this.packages.get(id);
    }

    setPackage(p: Package) {
        this.packages.set(p.id, p);
        this.notify();
    }
}

export const packageManager = new PackageManager();