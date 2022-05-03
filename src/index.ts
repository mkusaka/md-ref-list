import * as fs from "fs";
import * as parser from "@textlint/markdown-to-ast";
import * as glob from "fast-glob";
import fetch from "node-fetch";
import chalk from "chalk";
import { TxtNode } from "@textlint/ast-node-types";

async function main() {
  const [filepath] = process.argv.slice(2);
  if (!filepath) {
    chalk.red("filepath does not specified");
    process.exit(1);
  }
  console.log("filepath", filepath);

  const files = glob.sync(filepath);

  const result: {
    [filename: string]: {
      [link: string]: string;
    };
  } = {};

  if (files.length === 0) {
    chalk.red("there is no target files");
    process.exit(1);
  }
  await Promise.all(
    files.map(async (file) => {
      result[file] ||= {};
      const content = fs.readFileSync(file, { encoding: "utf8" });
      const parsed = parser.parse(content);
      const links: string[] = [];
      worker(parsed, links);
      await Promise.all(
        [...new Set(links)].map(async (link) => {
          let title = link;
          chalk.blue(`processing ${link}...`);
          try {
            const body = await (await fetch(link)).text();
            title = body.match(/<title>(.+)<\/title>/)?.[1] || link;
          } catch {
            chalk.red(`${link} title cannot find. fallback to url.`);
          }
          result[file][link] = title;
        })
      );
    })
  );

  if (files.length === 1) {
    let out = "";
    Object.entries(result).map(([_, v]) => {
      Object.entries(v).map(([url, title]) => {
        out += `- [${title}](${url})`;
      });
    });
    console.log(out);
  } else {
    console.log(result);
  }
}

function worker(node: TxtNode, links: string[] = []) {
  const children: TxtNode[] | undefined = node.children;
  if (node.type == "Link") {
    links.push(node.url);
  }
  if (children) {
    children.forEach((child) => {
      worker(child, links);
    });
  }
}

main();
