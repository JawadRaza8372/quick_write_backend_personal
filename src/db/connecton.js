const mongoose = require("mongoose");
const uri =
	"mongodb://root:jAeGTJ0onHryixjfGTcGVz83wu63wyFuNaE6xRytW4r0TNe9vk9SLWg93A8nO6Sw@194.163.44.47:5432/?directConnection=true";

mongoose
	.connect(uri, {
		serverSelectionTimeoutMS: 30000,
	})
	.then(() => {
		console.log("connection is successfull");
	})
	.catch((error) => {
		console.log("message: " + error);
	});
