const { db } = require('./db');
const http = require('http');

function randomId() {
    return Math.random().toString(36).substring(2, 15);
}

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseBody));
                } catch (e) {
                    resolve(responseBody);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function verify() {
    const uniqueId = randomId();
    console.log('1. Creating dummy proposal:', uniqueId);

    try {
        db.prepare(`
            INSERT INTO proposals (unique_id, persona, sender_name, recipient_name, content, status)
            VALUES (?, 'fortune', 'Test Sender', 'Test Recipient', '{}', 'pending')
        `).run(uniqueId);
    } catch (e) {
        console.error('Error inserting dummy:', e);
        return;
    }

    console.log('2. Responding with note...');
    const note = "This is a test note! 💌";

    try {
        const responseData = await post(`/respond/${uniqueId}`, { status: 'accepted', note });
        console.log('Response API result:', responseData);

        if (!responseData.success) {
            console.error('API failed');
            return;
        }

        console.log('3. Fetching My Proposals...');
        const myData = await post('/my-proposals', { ids: [uniqueId] });
        console.log('My Proposals API result:', JSON.stringify(myData, null, 2));

        const proposal = myData.proposals[0];
        if (proposal && proposal.response_note === note && proposal.status === 'accepted') {
            console.log('✅ SUCCESS: Note was saved and retrieved correctly!');
        } else {
            console.error('❌ FAILURE: Note mismatch or missing.');
            console.log('Expected:', note);
            console.log('Got:', proposal ? proposal.response_note : 'No proposal');
        }
    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        // Cleanup
        db.prepare('DELETE FROM proposals WHERE unique_id = ?').run(uniqueId);
    }
}

verify();
