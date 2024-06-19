document.addEventListener('DOMContentLoaded', function() {
    const statusCircles = document.querySelectorAll('.status-circle');

    statusCircles.forEach(function(circle) {
        const host = circle.getAttribute('data-host');

        circle.style.backgroundColor = 'white';
        circle.setAttribute('title', 'Check server status');

        circle.addEventListener('click', async () => {
            circle.style.backgroundColor = 'gold';
            circle.setAttribute('title', 'Loading...');

            try {
                const response = await Promise.race([
                    fetch(host),
                    new Promise((_, reject) =>
                        setTimeout(() => reject('Timeout'), 10000)
                    )
                ]);

                if (response.ok) {
                    circle.style.backgroundColor = 'green';
                    const data = await response.json();
                    const title = data.users ? `Online (${Number(data.users).toLocaleString()} users)` : 'Online';
                    circle.setAttribute('title', title);
                } else {
                    circle.style.backgroundColor = 'red';
                    circle.setAttribute('title', 'Unavailable');
                }
            } catch (error) {
                circle.style.backgroundColor = 'red';
                circle.setAttribute('title', 'Offline');
            }
        });
    });
});
