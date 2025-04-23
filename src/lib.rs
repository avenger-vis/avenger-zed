use zed_extension_api as zed;

struct AvengerExtension {
    // ... state
}

impl zed::Extension for AvengerExtension {
    fn new() -> Self
    where
        Self: Sized {
        AvengerExtension {}
    }
    // ...
}

zed::register_extension!(AvengerExtension);