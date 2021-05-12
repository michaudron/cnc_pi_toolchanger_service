var fs = require('fs');

class Config {
    save(state) {
        let data = JSON.stringify(state);
        fs.writeFile('./config.json', data, function (err) {
            if (err) {
                console.log('There has been an error saving your configuration data.');
                console.log(err.message);
                return;
            }
            // console.log('Configuration saved successfully.')
        });
    }
    load() {
        try {
            let data = fs.readFileSync('./config.json');
            return JSON.parse(data);
        } catch (err) {
            // console.log('There has been an error parsing saved state.')
            // console.log(err);
            return null;
        }
    }
};

module.exports = new Config();