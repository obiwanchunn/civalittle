

all: config.js.gpg

pull:
	rsync -azP adam@mcdillers.com:/home/adam/projects/civalittle/. /home/Adam/projects/civalittle

push:
	rsync -azP /home/Adam/projects/civalittle/. adam@mcdillers.com:/home/adam/projects/civalittle
	
inchula:
	

hula:
	curl -X 'POST' 'http://civadam.mcdillers.com/' -H 'connection: close' -H 'content-type: application/json' -d $'{"value1":"Hulahoop Game","value2":"adam","value3":"46"}'

config.js.gpg: config.js
	gpg -c config.js

config.js: config.js.gpg
	gpg --decrypt config.js.gpg > config.js
