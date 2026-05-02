// No fetch require needed in Node 24

async function test() {
  const payload = {
    operations: [
      {
        type: 'create',
        data: {
          name: "Test Product",
          category: "Test",
          price: 1000,
          rowNumber: 1
        }
      }
    ]
  };

  const response = await fetch('http://localhost:8081/api/admin/catalogs/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text);
}

test();
