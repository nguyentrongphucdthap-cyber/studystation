// @ts-ignore
export const onRequestPost = async (context: any) => {
    try {
        const { request, env } = context;
        const apiKey = env.IMGBB_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'ImgBB API Key is not configured in .dev.vars' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get the image data from the request
        const formData = await request.formData();
        const imageFile = formData.get('image');

        if (!imageFile) {
            return new Response(JSON.stringify({ error: 'No image file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Prepare the request to ImgBB
        const imgbbFormData = new FormData();
        imgbbFormData.append('image', imageFile);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: imgbbFormData,
        });

        const data = await response.json();

        if (data.status !== 200) {
            return new Response(JSON.stringify({ error: data.error?.message || 'ImgBB upload failed' }), {
                status: data.status || 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Return the clean data to the frontend
        return new Response(JSON.stringify({
            url: data.data.url,
            thumb: data.data.thumb.url,
            delete_url: data.data.delete_url
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
