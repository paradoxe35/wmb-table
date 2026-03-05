import { SermonMeta } from '@localtypes/index';

export default class DocumentTitle {
    constructor(private doc: SermonMeta) {}

    getName() {
        return this.doc.title;
    }

    getYear<T = string | null>(): T {
        const value = this.doc.sermonDate ? '19' + this.doc.sermonDate.split('-')[0] : null;
        return value as unknown as T;
    }

    getId() {
        return this.doc.id;
    }

    getTranslationId() {
        return this.doc.translationId;
    }

    getTitle() {
        return this.doc.title;
    }

    getEnTitle() {
        return this.doc.enTitle;
    }

    getAudioLink() {
        return this.doc.audioLink;
    }

    getPdfLink() {
        return this.doc.pdfLink;
    }

    getWebLink() {
        return this.doc.webLink;
    }

    getDateLong() {
        return this.doc.dateLong;
    }

    toObject() {
        return this.doc;
    }
}
