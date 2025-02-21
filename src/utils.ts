import { load } from "cheerio";

const $ = load("<html><body><a></a></body></html>");
const a = $("a");
// @ts-expect-error TS isn't smart enough here
// eslint-disable-next-line no-proto,@typescript-eslint/no-unsafe-assignment
const proto = a.__proto__;

const instanceOfCheerio = (something: unknown) => {
    if (something && typeof something === "object" && "__proto__" in something) {
        /* eslint-disable */
        return (
            // @ts-expect-error TS isn't smart enough here
            something.__proto__.constructor.name === proto.constructor.name
            // @ts-expect-error TS isn't smart enough here
            && Object.keys(something.__proto__).join(",") === Object.keys(proto).join(",")
        );
        /* eslint-enable */
    }
    return false;
};

export {
    instanceOfCheerio,
};
