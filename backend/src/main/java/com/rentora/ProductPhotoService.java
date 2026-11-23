package com.rentora;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductPhotoService {
    public List<byte[]> prepare(List<MultipartFile> files) {
        if(files==null || files.isEmpty() || files.size()>4) throw invalid("Choose between one and four product photos.");
        List<byte[]> output=new ArrayList<>();
        for(MultipartFile file:files) {
            if(file==null || file.isEmpty() || file.getSize()>5L*1024*1024) throw invalid("Each photo must contain an image and be no larger than 5 MB.");
            try(ImageInputStream input=ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
                if(input==null) throw invalid("Use a valid JPG or PNG photo.");
                Iterator<ImageReader> readers=ImageIO.getImageReaders(input);
                if(!readers.hasNext()) throw invalid("Use a valid JPG or PNG photo.");
                ImageReader reader=readers.next();
                try {
                    reader.setInput(input,true,true);
                    String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                    if(!List.of("jpeg","jpg","png").contains(format)) throw invalid("Only JPG and PNG photos are supported.");
                    int width=reader.getWidth(0),height=reader.getHeight(0);
                    if(width<1 || height<1 || width>10000 || height>10000 || (long)width*height>25_000_000)
                        throw invalid("Use a photo with no more than 25 megapixels.");
                    var params=reader.getDefaultReadParam();
                    int sample=Math.max(1,(int)Math.ceil(Math.max(width,height)/1600.0));
                    params.setSourceSubsampling(sample,sample,0,0);
                    BufferedImage decoded=reader.read(0,params);
                    if(decoded==null) throw invalid("This image could not be read. Choose another photo.");
                    BufferedImage normalized=new BufferedImage(decoded.getWidth(),decoded.getHeight(),BufferedImage.TYPE_INT_RGB);
                    var graphics=normalized.createGraphics();
                    try { graphics.setColor(Color.WHITE);graphics.fillRect(0,0,normalized.getWidth(),normalized.getHeight());graphics.drawImage(decoded,0,0,null); }
                    finally { graphics.dispose(); }
                    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                    if(!ImageIO.write(normalized,"jpg",bytes)) throw invalid("The photo could not be processed.");
                    output.add(bytes.toByteArray()); // Re-encoding removes original metadata and embedded payloads.
                } finally { reader.dispose(); }
            } catch(IOException ex) { throw invalid("This image could not be read. Choose a valid JPG or PNG photo."); }
        }
        return output;
    }
    private ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}
