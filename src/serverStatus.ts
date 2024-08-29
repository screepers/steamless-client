/**
 * This script is used to display the status of a server by changing the color of an element.
 */
((document) => {
    const setLoading = (elem: HTMLElement) => {
        elem.style.backgroundColor = 'transparent';
        elem.style.border = '2px solid gold';
        elem.setAttribute('title', 'Loading...');
    };

    const setStatus = (elem: HTMLElement, color: string, title: string) => {
        elem.style.border = 'none';
        elem.style.backgroundColor = color;
        elem.setAttribute('title', title);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const statusIcons = document.querySelectorAll('[data-api]') as NodeListOf<HTMLElement>;

        statusIcons.forEach((elem) => {
            setStatus(elem, 'silver', 'Click to get server status');

            elem.addEventListener('click', async function handleClick() {
                elem.removeEventListener('click', handleClick);
                elem.style.cursor = 'default';

                setLoading(elem);

                try {
                    const host = elem.getAttribute('data-api');
                    if (!host) {
                        setStatus(elem, 'red', 'Invalid host');
                        return;
                    }

                    const response = (await Promise.race([
                        fetch(host),
                        new Promise((_, reject) => setTimeout(() => reject('Request timed out.'), 10000)),
                    ])) as Response;

                    if (response.ok && response.status === 200) {
                        const data = await response.json();
                        const users = Number(data.users || 0).toLocaleString();
                        const title = data.ok ? `Online (${users} users)` : 'Online';
                        setStatus(elem, 'green', title);
                    } else {
                        setStatus(elem, 'red', 'Unavailable');
                    }
                } catch (error) {
                    setStatus(elem, 'red', 'Offline');
                }
            });
        });
    });
})(document);
