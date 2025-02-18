import * as fs from "fs";
import * as path from "path";
import {Table} from "@bytelab.studio/syntra.plugin";

const INCLUDE_DIR: string[] = (process.env.INCLUDE_DIR ?? "").split(path.delimiter);

interface PackageJSON {
    name: string;
    dependencies: {
        [name: string]: string;
    };
}

const _require: NodeRequire = require;
require = ((id: string): any => {
    const namespaceSize: number = Table.namespaceStack.length;

    Table.namespaceStack.push(null);

    _require(id);

    Table.namespaceStack.splice(namespaceSize, Table.namespaceStack.length - namespaceSize);
}) as NodeRequire;

function loadIncludes(arr: string[]) {
    console.log("INFO: Check included dirs");

    for (let dir of INCLUDE_DIR) {
        if (!path.isAbsolute(dir)) {
            dir = path.join(process.cwd(), dir);
        }
        console.log(`INFO: Check '${dir}'`);
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            console.log(`WARN: '${dir}' does not exist or is not a directory`);
            continue;
        }

        const importFile = path.join(dir, "index.js");
        if (!fs.existsSync(importFile) || !fs.statSync(importFile).isFile()) {
            console.log(`WARN: '${importFile}' does not exist or is not a file`);
            continue;
        }

        arr.push(importFile);
    }
}

function loadPlugins(root: string, packageJSON: PackageJSON, buff: string[], initPackage: boolean = false): void {
    console.log(`INFO: Check '${packageJSON.name}'`);
    const depKeys: string[] = Object.keys(packageJSON.dependencies);

    if (packageJSON.name == "@bytelab.studio/syntra" || packageJSON.name == "@bytelab.studio/syntra.plugin") {
        return;
    }
    if (!depKeys.includes("@bytelab.studio/syntra.plugin") && !initPackage) {
        return;
    }
    if (!initPackage && !buff.includes(packageJSON.name)) {
        buff.push(packageJSON.name);
    }

    for (const key of depKeys) {
        const packageRoot: string = path.join(root, "node_modules", key);
        const packageFile: string = path.join(packageRoot, "package.json");
        if (!fs.existsSync(packageFile) || !fs.statSync(packageFile).isFile()) {
            console.log(`WARNING Cannot find package.json in '${packageRoot}'`);
            continue;
        }
        try {
            const packageJSON: PackageJSON = JSON.parse(fs.readFileSync(packageFile, "utf8"));
            loadPlugins(root, packageJSON, buff);
        } catch (e) {
            console.log(`WARNING: Cannot load package.json in '${packageFile}': ${e}`);
        }
    }
}

export function loadFromMain(): string[] {
    const subDir: string = path.join(__dirname, "..", "..", "..");
    let root: string;
    if (path.basename(subDir) == "node_modules") {
        root = path.join(subDir, "..");
    } else {
        root = path.join(__dirname, "..");
    }
    const rootPackage: string = path.join(root, "package.json");
    if (!fs.existsSync(rootPackage) || !fs.statSync(rootPackage).isFile()) {
        console.log(`Cannot find package.json in '${root}'`);
        process.exit(1);
    }
    try {
        const packageJSON: PackageJSON = JSON.parse(fs.readFileSync(rootPackage, "utf8"));
        const arr: string[] = [];
        loadPlugins(root, packageJSON, arr, true);
        loadIncludes(arr);
        return arr;
    } catch (e) {
        console.log(`Cannot load package.json in '${rootPackage}': ${e}`);
        process.exit(1);
    }
}