var cs;
var selectedComp = null;
var collapsedComps = {};
var currentSelectedCompName = null;
var LICENSE_SECRET = "CN2026-ULTRA-SECRET-KEY-XYZ789";
var PRODUCT_ID = "comp-navigator";
var apiURL = "https://script.google.com/macros/s/AKfycbwvZP_5vwALSsQn2ylt32PYoRl-wn46DM6s2l5Guj3oIsMp40NfW3fwLzid2k4UsoAv-A/exec";

// SHA-256 implementation for browser
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function makeLicKey(email) {
    var emailLower = email.toLowerCase().trim();
    var hash = await sha256(emailLower + PRODUCT_ID + LICENSE_SECRET);
    return "CN-" + 
           hash.substring(0, 4).toUpperCase() + "-" + 
           hash.substring(4, 8).toUpperCase() + "-" + 
           hash.substring(8, 12).toUpperCase();
}

async function checkLic(licKey, email) {
    if(!licKey || !email) return false;
    var expectedKey = await makeLicKey(email);
    return licKey === expectedKey;
}

function getMachineID() {
    var id = navigator.platform + "-" + navigator.userAgent.substring(0, 50);
    return btoa(id).substring(0, 12).replace(/[^a-zA-Z0-9]/g, '0');
}

async function validateLicenseOnline(email, licKey) {
    var machineID = getMachineID();
    var emailLower = email.toLowerCase().trim();
    var url = apiURL + "?action=validate&email=" + encodeURIComponent(emailLower) + "&key=" + encodeURIComponent(licKey) + "&machine=" + encodeURIComponent(machineID) + "&product=" + encodeURIComponent(PRODUCT_ID);
    try {
        var response = await fetch(url);
        var result = await response.json();
        return result.success ? {success:true} : {success:false, message:result.message};
    } catch(e) {
        var isValid = await checkLic(licKey, email);
        return isValid ? {success:true} : {success:false, message:"Offline validation failed"};
    }
}

function saveLicense(email, licKey) {
    localStorage.setItem('cn_email', email.toLowerCase().trim());
    localStorage.setItem('cn_key', licKey);
}

function loadLicense() {
    return {
        email: localStorage.getItem('cn_email') || '',
        key: localStorage.getItem('cn_key') || ''
    };
}

function clearLicense() {
    localStorage.removeItem('cn_email');
    localStorage.removeItem('cn_key');
}

async function isLicenseValid() {
    var lic = loadLicense();
    return await checkLic(lic.key, lic.email);
}

async function verifyLicenseOnStartup() {
    var lic = loadLicense();
    if(!lic.email || !lic.key) {
        showLicenseDialog();
        return false;
    }
    var result = await validateLicenseOnline(lic.email, lic.key);
    if(!result.success) {
        clearLicense();
        alert('License Error: ' + result.message);
        showLicenseDialog();
        return false;
    }
    return true;
}

async function showLicenseDialog() {
    var dialog = document.getElementById('licenseDialog');
    var emailInput = document.getElementById('emailInput');
    var keyInput = document.getElementById('keyInput');
    var errorDiv = document.getElementById('dialogError');
    var hasValidLicense = await isLicenseValid();
    var lic = loadLicense();
    emailInput.value = lic.email || '';
    keyInput.value = lic.key || '';
    errorDiv.textContent = '';
    if(hasValidLicense) {
        document.getElementById('activateBtn').disabled = true;
        document.getElementById('clearLicBtn').disabled = false;
        document.getElementById('cancelBtn').disabled = false;
        emailInput.setAttribute('readonly','readonly');
        keyInput.setAttribute('readonly','readonly');
        errorDiv.style.color = '#7ac47a';
        errorDiv.textContent = '✓ Licensed to ' + lic.email;
    } else {
        document.getElementById('activateBtn').disabled = false;
        document.getElementById('clearLicBtn').disabled = true;
        document.getElementById('cancelBtn').disabled = true;
        emailInput.removeAttribute('readonly');
        keyInput.removeAttribute('readonly');
        errorDiv.style.color = '#e67373';
        errorDiv.textContent = 'Enter license to activate';
    }
    dialog.classList.remove('hidden');
}

async function hideLicenseDialog() {
    if(!(await isLicenseValid())) return;
    document.getElementById('licenseDialog').classList.add('hidden');
}

function showDetailsPanel(compName) {
    currentSelectedCompName = compName;
    document.getElementById('compNameInput').value = compName;
    document.getElementById('detailsPanel').classList.remove('hidden');
    loadCompProperties(compName);
}

function hideDetailsPanel() {
    document.getElementById('detailsPanel').classList.add('hidden');
    currentSelectedCompName = null;
    var allTreeNames = document.querySelectorAll('.tree-name');
    for(var i=0; i<allTreeNames.length; i++) {
        allTreeNames[i].classList.remove('selected');
    }
}

function loadCompProperties(compName) {
    cs.evalScript('getCompProperties("' + compName + '")', function(result) {
        try {
            var props = JSON.parse(result);
            document.getElementById('widthInput').value = props.width;
            document.getElementById('heightInput').value = props.height;
            document.getElementById('fpsInput').value = props.frameRate;
            document.getElementById('compInfo').innerHTML =
                '<div class="prop-info-row"><span class="prop-info-label">Size:</span><span class="prop-info-value">' + props.width + ' × ' + props.height + '</span></div>' +
                '<div class="prop-info-row"><span class="prop-info-label">Duration:</span><span class="prop-info-value">' + props.duration.toFixed(2) + 's</span></div>' +
                '<div class="prop-info-row"><span class="prop-info-label">Frame Rate:</span><span class="prop-info-value">' + props.frameRate + ' fps</span></div>' +
                '<div class="prop-info-row"><span class="prop-info-label">Layers:</span><span class="prop-info-value">' + props.numLayers + '</span></div>';
        } catch(e) {console.error(e);}
    });
}

function renameComp() {
    if(!currentSelectedCompName) return;
    var newName = document.getElementById('compNameInput').value.trim();
    if(!newName || newName === currentSelectedCompName) return;
    cs.evalScript('renameComp("' + currentSelectedCompName + '","' + newName + '")', function(result) {
        if(result === 'success') {
            currentSelectedCompName = newName;
            refreshCompositions();
            showDetailsPanel(newName);
        } else {
            alert('Could not rename composition');
        }
    });
}

function applyResolution() {
    if(!currentSelectedCompName) return;
    var width = parseInt(document.getElementById('widthInput').value);
    var height = parseInt(document.getElementById('heightInput').value);
    if(!width || !height || width<1 || height<1) {
        alert('Enter valid width and height values');
        return;
    }
    cs.evalScript('setCompResolution("' + currentSelectedCompName + '",' + width + ',' + height + ')', function(result) {
        if(result === 'success') {
            loadCompProperties(currentSelectedCompName);
            refreshCompositions();
        } else {
            alert('Could not change resolution');
        }
    });
}

function applyFrameRate() {
    if(!currentSelectedCompName) return;
    var fps = parseFloat(document.getElementById('fpsInput').value);
    if(!fps || fps<=0) {
        alert('Enter a valid frame rate');
        return;
    }
    cs.evalScript('setCompFrameRate("' + currentSelectedCompName + '",' + fps + ')', function(result) {
        if(result === 'success') {
            loadCompProperties(currentSelectedCompName);
            refreshCompositions();
        } else {
            alert('Could not change frame rate');
        }
    });
}

function setupEventListeners() {
    document.getElementById('licBtn').onclick = showLicenseDialog;
    document.getElementById('refreshBtn').onclick = async function() {
        var lic = loadLicense();
        if(lic.email && lic.key) {
            var result = await validateLicenseOnline(lic.email, lic.key);
            if(!result.success) {
                clearLicense();
                alert('License Error: ' + result.message);
                showLicenseDialog();
                return;
            }
        }
        refreshCompositions();
    };
    document.getElementById('searchBox').oninput = handleSearch;
    document.getElementById('clearSearchBtn').onclick = clearSearch;
    document.getElementById('openBtn').onclick = openSelectedComp;
    document.getElementById('upBtn').onclick = goToParent;
    document.getElementById('renameBtn').onclick = renameComp;
    document.getElementById('applyResBtn').onclick = applyResolution;
    document.getElementById('applyFpsBtn').onclick = applyFrameRate;
    document.getElementById('compNameInput').onkeypress = function(e){if(e.key==='Enter')renameComp();};
    document.getElementById('widthInput').onkeypress = function(e){if(e.key==='Enter')applyResolution();};
    document.getElementById('heightInput').onkeypress = function(e){if(e.key==='Enter')applyResolution();};
    document.getElementById('fpsInput').onkeypress = function(e){if(e.key==='Enter')applyFrameRate();};
    document.getElementById('buyBtn').onclick = function(){alert('Visit: yourwebsite.com\nEmail: youremail@example.com');};
    document.getElementById('clearLicBtn').onclick = async function() {
        if(!(await isLicenseValid())) return;
        if(confirm('Remove license? Extension will require reactivation.')) {
            clearLicense();
            document.getElementById('emailInput').value = '';
            document.getElementById('keyInput').value = '';
            document.getElementById('emailInput').removeAttribute('readonly');
            document.getElementById('keyInput').removeAttribute('readonly');
            document.getElementById('activateBtn').disabled = false;
            document.getElementById('clearLicBtn').disabled = true;
            document.getElementById('cancelBtn').disabled = true;
            var errorDiv = document.getElementById('dialogError');
            errorDiv.style.color = '#e67373';
            errorDiv.textContent = 'License cleared. Enter new license to continue.';
        }
    };
    document.getElementById('activateBtn').onclick = activateLicense;
    document.getElementById('cancelBtn').onclick = async function(){if(await isLicenseValid())hideLicenseDialog();};
}

async function activateLicense() {
    var emailInput = document.getElementById('emailInput');
    var keyInput = document.getElementById('keyInput');
    var errorDiv = document.getElementById('dialogError');
    var email = emailInput.value.trim();
    var key = keyInput.value.trim();
    
    if(!email || !key) {
        errorDiv.style.color = '#e67373';
        errorDiv.textContent = 'Enter both email and license key';
        return;
    }
    
    errorDiv.style.color = '#c8c8c8';
    errorDiv.textContent = 'Validating...';
    
    var result = await validateLicenseOnline(email, key);
    
    if(result.success) {
        saveLicense(email, key);
        errorDiv.style.color = '#7ac47a';
        errorDiv.textContent = '✓ License activated!';
        emailInput.setAttribute('readonly','readonly');
        keyInput.setAttribute('readonly','readonly');
        document.getElementById('activateBtn').disabled = true;
        document.getElementById('clearLicBtn').disabled = false;
        document.getElementById('cancelBtn').disabled = false;
        setTimeout(function(){hideLicenseDialog();refreshCompositions();}, 1000);
    } else {
        errorDiv.style.color = '#e67373';
        errorDiv.textContent = result.message || 'Invalid license key';
    }
}

function refreshCompositions() {
    collapsedComps = {};
    updateCompositions(document.getElementById('searchBox').value);
}

function updateCompositions(searchQuery) {
    cs.evalScript('getAllCompsData("' + searchQuery + '")', function(result) {
        try {
            var data = JSON.parse(result);
            renderTree(data.comps, data.activeComp);
            updateStatus(data.comps.length);
            updateCurrentComp(data.activeComp);
        } catch(e) {console.error(e);}
    });
}

function renderTree(comps, activeComp) {
    var container = document.getElementById('treeContainer');
    container.innerHTML = '';
    if(!comps || comps.length === 0) {
        container.innerHTML = '<div class="empty-state">No compositions in project</div>';
        hideDetailsPanel();
        return;
    }
    comps.forEach(function(comp) {
        if(comp.isRoot) renderCompNode(container, comp, 0, activeComp);
    });
}

function renderCompNode(container, comp, depth, activeComp) {
    var nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';
    nodeDiv.style.paddingLeft = (depth*16) + 'px';
    var hasChildren = comp.nested && comp.nested.length > 0;
    var collapseKey = comp.name + '_' + depth;
    var isCollapsed = collapsedComps[collapseKey] || false;
    var arrow = document.createElement('button');
    arrow.className = 'tree-arrow';
    arrow.innerHTML = hasChildren ? (isCollapsed ? '›' : '∨') : '&nbsp;';
    if(hasChildren) {
        arrow.onclick = (function(key) {
            return function() {
                collapsedComps[key] = !collapsedComps[key];
                refreshCompositions();
            };
        })(collapseKey);
    }
    nodeDiv.appendChild(arrow);
    var nameBtn = document.createElement('button');
    nameBtn.className = 'tree-name';
    if(comp.name === activeComp) nameBtn.classList.add('active');
    if(comp.name === currentSelectedCompName) nameBtn.classList.add('selected');
    nameBtn.textContent = comp.name;
    nameBtn.onclick = (function(compName) {
        return function() {
            selectedComp = compName;
            document.getElementById('openBtn').disabled = false;
            updateCurrentComp(compName);
            checkParentExists(compName);
            showDetailsPanel(compName);
        };
    })(comp.name);
    nameBtn.ondblclick = (function(compName) {
        return function() {
            cs.evalScript('openComp("' + compName + '")', function(result) {
                if(result === 'success') refreshCompositions();
            });
        };
    })(comp.name);
    nodeDiv.appendChild(nameBtn);
    var usage = document.createElement('span');
    usage.className = 'tree-usage';
    usage.textContent = comp.usageCount + 'x';
    nodeDiv.appendChild(usage);
    container.appendChild(nodeDiv);
    if(hasChildren && !isCollapsed) {
        comp.nested.forEach(function(nestedComp) {
            renderCompNode(container, nestedComp, depth+1, activeComp);
        });
    }
}

function updateCurrentComp(compName) {
    document.getElementById('currentCompName').textContent = compName || 'None';
}

function updateStatus(count) {
    document.getElementById('statusText').textContent = count + ' composition' + (count!==1 ? 's' : '');
}

function checkParentExists(compName) {
    cs.evalScript('hasParentComp("' + compName + '")', function(result) {
        document.getElementById('upBtn').disabled = result === 'false';
    });
}

function handleSearch() {
    updateCompositions(document.getElementById('searchBox').value);
}

function clearSearch() {
    document.getElementById('searchBox').value = '';
    updateCompositions('');
}

function openSelectedComp() {
    if(selectedComp) {
        cs.evalScript('openComp("' + selectedComp + '")', function(result) {
            if(result === 'success') refreshCompositions();
            else alert('Could not open composition');
        });
    }
}

function goToParent() {
    var compName = selectedComp || document.getElementById('currentCompName').textContent;
    if(compName && compName !== 'None') {
        cs.evalScript('goToParentComp("' + compName + '")', function(result) {
            if(result !== 'error') {
                selectedComp = result;
                refreshCompositions();
            }
        });
    }
}

async function init() {
    cs = new CSInterface();
    setupEventListeners();
    var isValid = await verifyLicenseOnStartup();
    if(isValid) {
        refreshCompositions();
    }
}

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}