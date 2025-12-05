export class StringUtil {
    public static removeHtmlTags = (html: string | undefined): string => {
        return html?.replace(/(<([^>]+)>)/gi, '') ?? '';
    };
}
