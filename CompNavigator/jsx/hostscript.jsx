// Comp Navigator - Host Script
// Runs in After Effects ExtendScript context

// JSON polyfill for ExtendScript
if (typeof JSON === 'undefined') {
    JSON = {
        stringify: function(obj) {
            var t = typeof (obj);
            if (t != "object" || obj === null) {
                if (t == "string") return '"' + obj + '"';
                return String(obj);
            } else {
                var n, v, json = [], arr = (obj && obj.constructor == Array);
                for (n in obj) {
                    v = obj[n];
                    t = typeof(v);
                    if (t == "string") v = '"' + v + '"';
                    else if (t == "object" && v !== null) v = JSON.stringify(v);
                    json.push((arr ? "" : '"' + n + '":') + String(v));
                }
                return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
            }
        }
    };
}

function getAllCompsData(searchQuery) {
    try {
        var result = {comps: [], activeComp: null};
        if (!app.project) return JSON.stringify(result);
        
        try {
            var activeItem = app.project.activeItem;
            if (activeItem && activeItem instanceof CompItem) {
                result.activeComp = activeItem.name;
            }
        } catch(e) {}
        
        var allComps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem) {
                allComps.push(item);
            }
        }
        
        for (var i = 0; i < allComps.length; i++) {
            var comp = allComps[i];
            if (searchQuery && searchQuery !== "" && comp.name.toLowerCase().indexOf(searchQuery.toLowerCase()) === -1) {
                continue;
            }
            var compData = {
                name: comp.name,
                isRoot: isRootComp(comp, allComps),
                usageCount: getCompUsageCount(comp, allComps),
                nested: getNestedComps(comp, allComps)
            };
            result.comps.push(compData);
        }
        return JSON.stringify(result);
    } catch(error) {
        return '{"comps":[],"activeComp":null,"error":"' + error.toString() + '"}';
    }
}

function isRootComp(comp, allComps) {
    for (var i = 0; i < allComps.length; i++) {
        var otherComp = allComps[i];
        for (var j = 1; j <= otherComp.numLayers; j++) {
            try {
                var layer = otherComp.layer(j);
                if (layer.source && layer.source === comp) {
                    return false;
                }
            } catch(e) {}
        }
    }
    return true;
}

function getCompUsageCount(comp, allComps) {
    var count = 0;
    for (var i = 0; i < allComps.length; i++) {
        var otherComp = allComps[i];
        for (var j = 1; j <= otherComp.numLayers; j++) {
            try {
                var layer = otherComp.layer(j);
                if (layer.source && layer.source === comp) {
                    count++;
                }
            } catch(e) {}
        }
    }
    return count;
}

function getNestedComps(comp, allComps) {
    var nested = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        try {
            var layer = comp.layer(i);
            if (layer.source && layer.source instanceof CompItem) {
                var nestedData = {
                    name: layer.source.name,
                    isRoot: false,
                    usageCount: getCompUsageCount(layer.source, allComps),
                    nested: getNestedComps(layer.source, allComps)
                };
                nested.push(nestedData);
            }
        } catch(e) {}
    }
    return nested;
}

function openComp(compName) {
    try {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                item.openInViewer();
                return "success";
            }
        }
        return "error";
    } catch(e) {
        return "error";
    }
}

function hasParentComp(compName) {
    try {
        var targetComp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                targetComp = item;
                break;
            }
        }
        if (!targetComp) return "false";
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem) {
                for (var j = 1; j <= item.numLayers; j++) {
                    try {
                        var layer = item.layer(j);
                        if (layer.source && layer.source === targetComp) {
                            return "true";
                        }
                    } catch(e) {}
                }
            }
        }
        return "false";
    } catch(e) {
        return "false";
    }
}

function goToParentComp(compName) {
    try {
        var targetComp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                targetComp = item;
                break;
            }
        }
        if (!targetComp) return "error";
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem) {
                for (var j = 1; j <= item.numLayers; j++) {
                    try {
                        var layer = item.layer(j);
                        if (layer.source && layer.source === targetComp) {
                            item.openInViewer();
                            return item.name;
                        }
                    } catch(e) {}
                }
            }
        }
        return "error";
    } catch(e) {
        return "error";
    }
}

function getCompProperties(compName) {
    try {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                var props = {
                    width: item.width,
                    height: item.height,
                    duration: item.duration,
                    frameRate: item.frameRate,
                    numLayers: item.numLayers
                };
                return JSON.stringify(props);
            }
        }
        return '{}';
    } catch(e) {
        return '{}';
    }
}

function renameComp(oldName, newName) {
    try {
        app.beginUndoGroup("Rename Comp");
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === oldName) {
                item.name = newName;
                app.endUndoGroup();
                return "success";
            }
        }
        app.endUndoGroup();
        return "error";
    } catch(e) {
        app.endUndoGroup();
        return "error";
    }
}

function setCompResolution(compName, width, height) {
    try {
        app.beginUndoGroup("Change Comp Resolution");
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                item.width = parseInt(width);
                item.height = parseInt(height);
                app.endUndoGroup();
                return "success";
            }
        }
        app.endUndoGroup();
        return "error";
    } catch(e) {
        app.endUndoGroup();
        return "error";
    }
}

function setCompFrameRate(compName, frameRate) {
    try {
        app.beginUndoGroup("Change Comp Frame Rate");
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                item.frameRate = parseFloat(frameRate);
                app.endUndoGroup();
                return "success";
            }
        }
        app.endUndoGroup();
        return "error";
    } catch(e) {
        app.endUndoGroup();
        return "error";
    }
}