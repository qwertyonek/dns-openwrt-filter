let supportedDevices = null;
let filterEnabled = false;
let debounceTimer = null;

async function init() {
    try {
        const url = chrome.runtime.getURL('supported_devices.json');
        const response = await fetch(url);
        const rawData = await response.json();
        
        // Optimize data structure for faster lookup
        supportedDevices = {};
        for (const brand in rawData) {
            supportedDevices[brand] = {
                normalizedName: normalize(brand),
                models: [...rawData[brand]].sort((a, b) => b.length - a.length)
            };
        }
        
        setInterval(injectFilter, 2000);
        observeDOM();
    } catch (e) {
        console.error('DNS OpenWrt Filter: Init failed', e);
    }
}

function normalize(str) {
    if (!str) return '';
    return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function injectFilter() {
    if (document.getElementById('openwrt-filter-root')) return;

    const sidebar = document.querySelector('.left-filters__list') || 
                    document.querySelector('[data-role="filter-list"]') || 
                    document.querySelector('.left-filters') ||
                    document.querySelector('.filters-container');
                    
    if (!sidebar) return;

    const filterRoot = document.createElement('div');
    filterRoot.id = 'openwrt-filter-root';
    filterRoot.className = 'openwrt-filter-container';
    filterRoot.innerHTML = `
        <div style="padding: 12px; background: #fff1e6; border: 2px solid #e46016; border-radius: 8px; margin-bottom: 15px;">
            <label style="display: flex; align-items: center; cursor: pointer; font-family: sans-serif; margin: 0;">
                <input type="checkbox" id="openwrt-filter-checkbox" style="width: 22px; height: 22px; margin-right: 12px; cursor: pointer;">
                <span style="font-weight: 900; color: #e46016; font-size: 14px;">ПОДДЕРЖКА OPENWRT</span>
                
                <div class="openwrt-tooltip" style="position: relative; display: inline-flex; align-items: center; justify-content: center; margin-left: 8px; width: 20px; height: 20px; background: #ccc; color: #fff; border-radius: 50%; font-size: 14px; cursor: help;">?
                    <span class="openwrt-tooltip-text" style="visibility: hidden; width: 260px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 10px; position: absolute; z-index: 1000; bottom: 130%; left: 50%; margin-left: -130px; font-size: 12px; font-weight: normal; box-shadow: 0px 4px 6px rgba(0,0,0,0.2); line-height: 1.4;">
                        Расширение может иметь погрешности по аппаратным версиям (v1, v2 и т.д.).<br><br>
                        Всегда проверяйте наличие прошивки именно под вашу ревизию на сайте:<br>
                        <b style="color: #ff9800;">firmware-selector.openwrt.org</b>
                    </span>
                </div>
            </label>
        </div>
    `;

    if (!document.getElementById('openwrt-tooltip-styles')) {
        const style = document.createElement('style');
        style.id = 'openwrt-tooltip-styles';
        style.innerHTML = `
            .openwrt-tooltip:hover .openwrt-tooltip-text { visibility: visible !important; }
            .catalog-product__buy { flex-wrap: wrap !important; } 
        `;
        document.head.appendChild(style);
    }

    sidebar.prepend(filterRoot);

    const checkbox = document.getElementById('openwrt-filter-checkbox');
    checkbox.checked = filterEnabled;
    checkbox.addEventListener('change', (e) => {
        filterEnabled = e.target.checked;
        applyFilter(true); // Force re-process on toggle
    });
}

function applyFilter(force = false) {
    if (debounceTimer) clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
        const selector = force ? '.catalog-product' : '.catalog-product:not([data-openwrt-processed])';
        const products = document.querySelectorAll(selector);
        if (products.length === 0 && !force) return;

        products.forEach((product) => {
            product.setAttribute('data-openwrt-processed', 'true');
            
            let title = '';
            const nameLink = product.querySelector('.catalog-product__name-link') || 
                             product.querySelector('a.ui-link');
                             
            if (nameLink) {
                title = nameLink.innerText || nameLink.textContent;
                const span = nameLink.querySelector('span');
                if (span && (!title || title.trim() === '')) {
                    title = span.innerText || span.textContent;
                }
            }

            title = title ? title.trim() : '';
            const match = title ? findMatch(title) : null;

            if (match) {
                product.setAttribute('data-openwrt-match', 'true');
                const buyContainer = product.querySelector('.catalog-product__buy');
                                     
                if (buyContainer && !product.querySelector('.openwrt-card-btn')) {
                    const btn = document.createElement('a');
                    btn.className = 'button-ui button-ui_white openwrt-card-btn';
                    btn.innerHTML = `<span style="display: flex; align-items: center; justify-content: center; width: 100%;">
                        <svg style="width: 16px; height: 16px; margin-right: 6px; color: #e46016;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                        В Selector (Копировать)
                    </span>`;
                    btn.href = "javascript:void(0)";
                    btn.style.cssText = "display: block; flex-basis: 100%; margin-top: 8px; order: 10; border: 1px solid #d9d9d9; border-radius: 8px; padding: 8px 12px; font-size: 14px; text-align: center; text-decoration: none; color: #333; background: #fff; transition: border-color 0.2s; box-sizing: border-box; cursor: pointer;";
                    btn.onmouseover = () => btn.style.borderColor = '#e46016';
                    btn.onmouseout = () => btn.style.borderColor = '#d9d9d9';

                    btn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const cleanModel = match.m.replace(/\s*\(.*?\)\s*/g, '').trim();
                        const searchString = match.b + ' ' + cleanModel;
                        navigator.clipboard.writeText(searchString).then(() => {
                            const originalHTML = btn.innerHTML;
                            btn.innerHTML = '<span style="color: #4caf50; font-weight: bold;">Скопировано! Открываем...</span>';
                            btn.style.borderColor = '#4caf50';
                            setTimeout(() => {
                                window.open('https://firmware-selector.openwrt.org/', '_blank');
                                btn.innerHTML = originalHTML;
                                btn.style.borderColor = '#d9d9d9';
                            }, 800);
                        });
                    };
                    buyContainer.appendChild(btn);
                }
            } else {
                product.removeAttribute('data-openwrt-match');
            }

            // Update visibility
            if (filterEnabled) {
                product.style.display = match ? '' : 'none';
            } else {
                product.style.display = '';
            }
        });

        // If force is true, we might need to check all products even if they were processed
        if (force) {
            document.querySelectorAll('.catalog-product[data-openwrt-processed]').forEach(product => {
                const isMatch = product.getAttribute('data-openwrt-match') === 'true';
                product.style.display = (!filterEnabled || isMatch) ? '' : 'none';
            });
        }

    }, 200);
}

function findMatch(title) {
    let cleanTitle = title.replace(/^Wi-Fi роутер\s+/i, '');
    cleanTitle = cleanTitle.split('[')[0].trim();
    
    const nt = normalize(cleanTitle);
    
    for (const brand in supportedDevices) {
        const brandData = supportedDevices[brand];
        if (nt.includes(brandData.normalizedName)) {
            for (const model of brandData.models) {
                const nm = normalize(model);
                if (nm.length < 3) continue;
                const regex = new RegExp(nm + '(?![A-Z0-9])');
                if (regex.test(nt)) {
                    return { b: brand, m: model };
                }
            }
        }
    }
    return null;
}

function observeDOM() {
    const observer = new MutationObserver((mutations) => {
        let added = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) { 
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && (node.classList.contains('catalog-product') || node.querySelector('.catalog-product'))) {
                        added = true; 
                        break; 
                    }
                }
            }
            if (added) break;
        }
        if (added) applyFilter();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

init();
