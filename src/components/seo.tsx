import { useEffect } from "react";

export const SITE_URL = "https://community.tailed.ca";
export const SITE_NAME = "Tail'ed";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/tailed-community-logo.png`;

type SeoProps = {
    /** Page title WITHOUT brand suffix. */
    title: string;
    description: string;
    /** Route path like "/jobs"; when provided renders a canonical link. */
    path?: string;
    /** Absolute URL; defaults to DEFAULT_OG_IMAGE. */
    image?: string;
    type?: "website" | "article";
    /** When true, use title verbatim instead of appending " | Tail'ed". */
    noSuffix?: boolean;
    /** schema.org JSON-LD object(s) to embed. */
    jsonLd?: object | object[];
};

export function Seo({
    title,
    description,
    path,
    image,
    type = "website",
    noSuffix = false,
    jsonLd,
}: SeoProps) {
    const fullTitle = noSuffix ? title : `${title} | ${SITE_NAME}`;
    const resolvedImage = image || DEFAULT_OG_IMAGE;
    const url = path ? `${SITE_URL}${path}` : SITE_URL;

    useEffect(() => {
        document.title = fullTitle;
    }, [fullTitle]);

    const jsonLdItems = jsonLd
        ? Array.isArray(jsonLd)
            ? jsonLd
            : [jsonLd]
        : [];

    return (
        <>
            <meta name="description" content={description} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={url} />
            <meta property="og:image" content={resolvedImage} />
            <meta property="og:type" content={type} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={resolvedImage} />
            {path && <link rel="canonical" href={url} />}
            {jsonLdItems.map((item, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    // Feed-sourced strings can contain "</script" which would break out of
                    // the script tag if injected verbatim; escape "<" to neutralize it.
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(item).replace(/</g, "\\u003c"),
                    }}
                />
            ))}
        </>
    );
}
