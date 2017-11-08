const flatten = require('flat');

module.exports = function (inputJson, options) {
    const pathRegex = new RegExp(options.includePaths);
    const definitionRegex = new RegExp(options.includeDefinitions);
    const tagRegex = new RegExp(options.includeTags);
    inputJson = JSON.parse(inputJson);

    let definitionsMap = {};
    for (const defLocalizationName in inputJson) {
        if (isObject(inputJson[defLocalizationName])) {
            searchReferencesFor(inputJson[defLocalizationName], inputJson, definitionsMap);
        }
    }

    const paths = inputJson.paths;
    if (options.includePaths) {
        removeUnwantedKeys(paths, pathRegex);
    }
    if (options.includeTags) {
        removeUnwantedTags(paths, tagRegex);
    }
    let whiteList = {};
    if (options.includeDefinitions) {
        saveDefinitions(definitionRegex, definitionsMap, whiteList, inputJson);
    }
    for (const path in paths) {
        searchReferencesFor(paths[path], inputJson, whiteList);
    }
    clearMismatchedElements(inputJson, definitionsMap, whiteList);
    return filterJson(inputJson, whiteList);
};

function removeUnwantedKeys(objectToFilter, keyRegex) {
    for (const key in objectToFilter) {
        if (!keyRegex.test(key)) {
            delete objectToFilter[key];
        }
    }
}

function removeUnwantedTags(objectToFilter, tagRegex) {
    for (const key in objectToFilter) {
        let keepKey = false;
        for (const ops in objectToFilter[key]) {
            let keepOp = false;
            let tags = objectToFilter[key][ops].tags;
            if (tags) {
                tags.forEach(function(tag) {
                    if (tagRegex.test(tag)) {
                        keepOp = true;
                        keepKey = true;
                    }
                });
            }
            if (!keepOp) {
                delete objectToFilter[key][ops];
            }
        }
        if (!keepKey) {
            delete objectToFilter[key];
        }
    }
}

function saveDefinitions(definitionRegex, definitionsMap, whiteList, inputJson) {
    for (const defLocalizationName in definitionsMap) {
        for (const defName in inputJson[defLocalizationName]) {
            const nestedDefinition = inputJson[defLocalizationName][defName];
            if (definitionRegex.test(defName) && shouldSaveReference(defLocalizationName, defName, whiteList)) {
                saveReference(defLocalizationName, defName, whiteList);
                if (isObject(nestedDefinition)) {
                    searchReferencesFor(nestedDefinition, inputJson, whiteList);
                }
            }
        }
    }
}

function isObject(value) {
    return (typeof value === 'object');
}

function saveReference(defLocalizationName, defName, definitionsMap) {
    definitionsMap[defLocalizationName] = definitionsMap[defLocalizationName] || [];
    definitionsMap[defLocalizationName].push(defName);
}

function shouldSaveReference(defLocalizationName, defName, definitionsMap) {
    return !definitionsMap[defLocalizationName] || definitionsMap[defLocalizationName].indexOf(defName) < 0;
}

function searchReferencesFor(definition, inputJson, definitionsMap) {
    const flattenDefinition = flatten(definition);
    for (const key in flattenDefinition) {
        let value = flattenDefinition[key];
        if (key.includes('$ref')) {
            const [defLocalizationName, defName] = value.slice(2).split('/');
            const nestedDefinition = inputJson[defLocalizationName][defName];
            if (shouldSaveReference(defLocalizationName, defName, definitionsMap)) {
                saveReference(defLocalizationName, defName, definitionsMap);
                if (isObject(nestedDefinition)) {
                    searchReferencesFor(nestedDefinition, inputJson, definitionsMap);
                }
            }
        }
    }
}

function clearMismatchedElements(obj, someList, whiteList) {
    for (const key in someList) {
        if (!whiteList.hasOwnProperty(key)) {
            obj[key] = {};
        }
    }
}

function filterJson(inputJson, definitionsMap) {
    for (const defLocalizationName in definitionsMap) {
        let expectedDefNames = definitionsMap[defLocalizationName];
        for (const key in inputJson[defLocalizationName]) {
            if (expectedDefNames.indexOf(key) < 0) {
                delete inputJson[defLocalizationName][key];
            }
        }
    }
    return JSON.stringify(inputJson);
}

