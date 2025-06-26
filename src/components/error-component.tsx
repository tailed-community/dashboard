const errorImgLight = "/error-light.png";
import { m } from "@/paraglide/messages.js";
// // import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export function ErrorComponent() {
  return (
    <div className="flex flex-col items-center h-full justify-center p-4">
      <div className="w-64 sm:w-78 md:w-96 mx-auto">
        <AspectRatio ratio={1}>
          <img src={errorImgLight} alt="Something went wrong" sizes={"100%"} />
        </AspectRatio>
      </div>
      <p className="text-2xl font-semibold mb-2 text-center">
        {m.its_not_you_its_us()}
      </p>
      <p className="text-lg text-center">
        {m.something_went_wrong_on_our_end_please_try_again_later()}
      </p>
    </div>
  );
}
