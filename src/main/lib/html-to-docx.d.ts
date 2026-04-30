declare module 'html-to-docx' {
    interface DocumentMargins {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
        header?: number;
        footer?: number;
        gutter?: number;
    }

    interface DocumentOptions {
        orientation?: 'portrait' | 'landscape';
        margins?: DocumentMargins;
        title?: string;
        creator?: string;
        font?: string;
        fontSize?: number;
        table?: { row?: { cantSplit?: boolean } };
        pageNumber?: boolean;
        header?: boolean;
        footer?: boolean;
        lineNumber?: boolean;
        lang?: string;
    }

    function htmlToDocx(
        htmlString: string,
        headerHtmlString?: string | null,
        documentOptions?: DocumentOptions,
        footerHtmlString?: string | null,
    ): Promise<Buffer>;

    export default htmlToDocx;
}
