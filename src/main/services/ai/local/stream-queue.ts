export class AsyncStreamQueue<T> implements AsyncIterable<T> {
    private items: T[] = [];
    private resolvers: Array<(value: IteratorResult<T>) => void> = [];
    private closed = false;

    push(item: T): void {
        if (this.closed) {
            return;
        }
        const resolver = this.resolvers.shift();
        if (resolver) {
            resolver({ value: item, done: false });
            return;
        }
        this.items.push(item);
    }

    close(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        while (this.resolvers.length > 0) {
            this.resolvers.shift()!({ value: undefined as T, done: true });
        }
    }

    async next(): Promise<IteratorResult<T>> {
        if (this.items.length > 0) {
            return { value: this.items.shift()!, done: false };
        }
        if (this.closed) {
            return { value: undefined as T, done: true };
        }
        return new Promise<IteratorResult<T>>((resolve) => {
            this.resolvers.push(resolve);
        });
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: () => {
                return this.next();
            },
        };
    }
}
