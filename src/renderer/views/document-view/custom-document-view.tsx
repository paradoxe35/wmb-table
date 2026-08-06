import { CustomDocumentReaderView } from './custom-document-reader';
import { useCustomDocumentReader } from './hooks';

export default function CustomDocumentView() {
    const reader = useCustomDocumentReader();
    return <CustomDocumentReaderView reader={reader} />;
}
