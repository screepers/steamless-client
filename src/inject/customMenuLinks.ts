/**
 * This function is injected into the client to customize the menu links.
 */
export function customMenuLinks(backend: string, seasonLink: string, ptrLink?: string, serverListLink?: string) {
    const appMenuSelector = 'app-menu.--ui';

    function updateAppMenu() {
        const appMenu = document.querySelector(appMenuSelector);

        if (backend.includes('screeps.com')) {
            const switchLinks = ['https://screeps.com/season/#!/seasons/chronicle', 'https://screeps.com/a/'];

            appMenu?.querySelectorAll('a[href]').forEach((link) => {
                const href = link.getAttribute('href');
                if (href && switchLinks.includes(href)) {
                    link.setAttribute('href', seasonLink);
                    link.setAttribute('target', '_self');
                }
            });
        }

        const removeLinks = ['screeps.com/forum', 'twitter.com', 'mailto:'];

        appMenu?.querySelectorAll('a[href]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href?.includes('github.com/screeps/screeps')) {
                link.setAttribute('href', 'https://github.com/screepers/steamless-client');
                return;
            }

            if (href?.includes('screeps.com/ptr')) {
                if (ptrLink) {
                    link.setAttribute('href', ptrLink);
                    const label = link.querySelector('div div');
                    if (label) label.textContent = 'PTR';
                } else {
                    link.remove();
                }
                return;
            }

            if (href?.includes('facebook.com')) {
                if (serverListLink) {
                    link.setAttribute('href', serverListLink);
                    link.setAttribute('target', '_self');
                    link.querySelector('svg use')?.setAttribute('xlink:href', '#symbol-menu-change-server');
                    const label = link.querySelector('div div');
                    if (label) label.textContent = 'Change Server';
                } else {
                    link.remove();
                }
                return;
            }

            if (href && removeLinks.some((text) => href.includes(text))) {
                link.remove();
                return;
            }
        });
    }

    const observer = new MutationObserver((mutationsList) => {
        let shouldUpdate = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target as HTMLElement;
                if (target.classList.contains('--visible')) {
                    shouldUpdate = true;
                    break;
                }
            } else if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        const links = element.querySelectorAll('a[href*="facebook.com"]');
                        if (links.length) {
                            shouldUpdate = true;
                            return;
                        }
                    }
                });
                if (shouldUpdate) break;
            }
        }
        if (shouldUpdate) {
            updateAppMenu();
        }
    });

    const targetInterval = setInterval(() => {
        const targetNode = document.querySelector(appMenuSelector);
        if (targetNode) {
            observer.observe(targetNode, {
                attributes: true,
                childList: true,
                subtree: true,
            });
            clearInterval(targetInterval);
        }
    }, 100);
}
